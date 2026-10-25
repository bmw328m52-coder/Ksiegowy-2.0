import { X509Certificate, constants, publicEncrypt } from "node:crypto";

// Klient API KSeF 2.0 (Ministerstwo Finansów). Specyfikacja:
// https://api.ksef.mf.gov.pl/docs/v2  (openapi.json w tym samym katalogu)
// Używamy tylko odczytu: logowanie tokenem KSeF → lista metadanych faktur,
// gdzie Artur jest nabywcą (Subject2) → pobranie XML faktury po numerze KSeF.

export const KSEF_BASE_URL = process.env.KSEF_BASE_URL ?? "https://api.ksef.mf.gov.pl/v2";

export class KsefError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(
  path: string,
  init: { method?: string; bearer?: string; body?: unknown; accept?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: init.accept ?? "application/json",
    "X-Error-Format": "problem-details",
  };
  if (init.bearer) headers.Authorization = `Bearer ${init.bearer}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response | null = null;
  // Prosty retry na limit zapytań (429) — KSeF podaje Retry-After w sekundach.
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(`${KSEF_BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    if (res.status !== 429) break;
    const wait = Math.min(Number(res.headers.get("retry-after")) || 2, 20);
    await sleep(wait * 1000);
  }
  if (!res!.ok) throw new KsefError(await describeError(res!), res!.status);
  if ((init.accept ?? "application/json") !== "application/json") return (await res!.text()) as T;
  const text = await res!.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function describeError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  try {
    const j = JSON.parse(raw);
    const parts = [j.title, j.detail, ...(j.errors ?? []).map((e: { description?: string }) => e.description)];
    const ex = j.exception?.exceptionDetailList?.map(
      (e: { exceptionDescription?: string; details?: string[] }) =>
        [e.exceptionDescription, ...(e.details ?? [])].filter(Boolean).join(" — ")
    );
    const msg = [...parts, ...(ex ?? [])].filter(Boolean).join(" · ");
    if (msg) return `KSeF ${res.status}: ${msg}`;
  } catch {
    // nie-JSON
  }
  return `KSeF ${res.status}: ${raw.slice(0, 300) || res.statusText}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TokenInfo = { token: string; validUntil: string };

/** Klucz publiczny MF do szyfrowania tokena KSeF (RSA-OAEP SHA-256). */
async function tokenEncryptionCert(): Promise<{ pem: string; publicKeyId: string }> {
  const certs = await call<
    { certificate: string; publicKeyId: string; validFrom: string; validTo: string; usage: string[] }[]
  >("/security/public-key-certificates");
  const now = Date.now();
  const c = certs.find(
    (x) =>
      x.usage.includes("KsefTokenEncryption") &&
      Date.parse(x.validFrom) <= now &&
      Date.parse(x.validTo) > now
  );
  if (!c) throw new KsefError("KSeF nie udostępnił aktualnego klucza do szyfrowania tokena.");
  const x509 = new X509Certificate(Buffer.from(c.certificate, "base64"));
  return { pem: x509.publicKey.export({ type: "spki", format: "pem" }) as string, publicKeyId: c.publicKeyId };
}

/**
 * Pełne logowanie tokenem KSeF. Zwraca access token (JWT) ważny kilkanaście minut —
 * wystarczy na jedną synchronizację, więc nie przechowujemy go.
 */
export async function authenticateWithToken(ksefToken: string, nip: string): Promise<string> {
  const [challenge, cert] = await Promise.all([
    call<{ challenge: string; timestampMs: number }>("/auth/challenge", { method: "POST" }),
    tokenEncryptionCert(),
  ]);

  const encryptedToken = publicEncrypt(
    { key: cert.pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(`${ksefToken.trim()}|${challenge.timestampMs}`, "utf8")
  ).toString("base64");

  const init = await call<{ referenceNumber: string; authenticationToken: TokenInfo }>("/auth/ksef-token", {
    method: "POST",
    body: {
      challenge: challenge.challenge,
      contextIdentifier: { type: "Nip", value: nip },
      encryptedToken,
      publicKeyId: cert.publicKeyId,
    },
  });
  const authToken = init.authenticationToken.token;

  // Uwierzytelnianie jest asynchroniczne — status 100 = w toku, 200 = OK.
  for (let i = 0; i < 30; i++) {
    const st = await call<{ status: { code: number; description: string; details?: string[] } }>(
      `/auth/${init.referenceNumber}`,
      { bearer: authToken }
    );
    if (st.status.code === 200) break;
    if (st.status.code !== 100) {
      throw new KsefError(
        `Logowanie do KSeF nieudane (${st.status.code}): ${[st.status.description, ...(st.status.details ?? [])].join(" — ")}`
      );
    }
    if (i === 29) throw new KsefError("KSeF nie potwierdził logowania w czasie — spróbuj ponownie.");
    await sleep(1000);
  }

  const tokens = await call<{ accessToken: TokenInfo }>("/auth/token/redeem", {
    method: "POST",
    bearer: authToken,
  });
  return tokens.accessToken.token;
}

export type KsefInvoiceMetadata = {
  ksefNumber: string;
  invoiceNumber: string;
  issueDate: string;
  permanentStorageDate: string;
  seller: { nip: string; name?: string | null };
  netAmount: number;
  grossAmount: number;
  vatAmount: number;
  currency: string;
  invoiceType: string;
};

type MetadataPage = {
  hasMore: boolean;
  isTruncated: boolean;
  permanentStorageHwmDate?: string | null;
  invoices: KsefInvoiceMetadata[];
};

const MAX_RANGE_MS = 95 * 24 * 3600 * 1000; // API pozwala na 100 dni — zostawiamy zapas

/**
 * Wszystkie faktury zakupowe (Artur = nabywca) zapisane w KSeF od `from`.
 * Scenariusz przyrostowy wg dokumentacji MF: data PermanentStorage, sortowanie Asc.
 * Zwraca też `syncedUntil` — do tej chwili dane są kompletne i nie trzeba ich
 * pobierać ponownie.
 */
export async function listPurchaseInvoices(
  accessToken: string,
  from: Date
): Promise<{ invoices: KsefInvoiceMetadata[]; syncedUntil: string }> {
  const out: KsefInvoiceMetadata[] = [];
  const now = Date.now();
  let windowFrom = from.getTime();
  let syncedUntil = new Date(windowFrom).toISOString();

  while (windowFrom < now) {
    const windowTo = Math.min(windowFrom + MAX_RANGE_MS, now);
    const isLast = windowTo >= now;
    let rangeFrom = new Date(windowFrom).toISOString();
    let offset = 0;

    for (;;) {
      const page = await call<MetadataPage>(
        `/invoices/query/metadata?sortOrder=Asc&pageSize=250&pageOffset=${offset}`,
        {
          method: "POST",
          bearer: accessToken,
          body: {
            subjectType: "Subject2",
            dateRange: {
              dateType: "PermanentStorage",
              from: rangeFrom,
              ...(isLast ? {} : { to: new Date(windowTo).toISOString() }),
              restrictToPermanentStorageHwmDate: true,
            },
          },
        }
      );
      out.push(...page.invoices);
      if (page.permanentStorageHwmDate) syncedUntil = page.permanentStorageHwmDate;
      else if (!isLast) syncedUntil = new Date(windowTo).toISOString();

      if (!page.hasMore) break;
      if (page.isTruncated && page.invoices.length > 0) {
        rangeFrom = page.invoices[page.invoices.length - 1].permanentStorageDate;
        offset = 0;
      } else {
        offset += 1;
      }
    }
    windowFrom = windowTo;
  }

  // Przy zawężaniu zakresu ta sama faktura może przyjść dwa razy.
  const unique = new Map(out.map((i) => [i.ksefNumber, i]));
  return { invoices: [...unique.values()], syncedUntil };
}

export async function downloadInvoiceXml(accessToken: string, ksefNumber: string): Promise<string> {
  return call<string>(`/invoices/ksef/${encodeURIComponent(ksefNumber)}`, {
    bearer: accessToken,
    accept: "application/xml",
  });
}
