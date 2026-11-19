import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";

export type OCRLineItem = {
  description: string;
  amount_net: number | null;
  amount_vat: number | null;
  amount_gross: number;
  vat_rate: number | null;
};

export type OCRResult = {
  document_type: "faktura" | "paragon" | "inne";
  /** Jak pewny jest odczyt kluczowych pól (NIP, kwoty, data). */
  confidence: "high" | "medium" | "low";
  /** Krótkie uwagi modelu: co było nieczytelne lub niepewne. */
  uncertain: string[];
  buyer_nip: string | null;
  supplier_address: { street: string | null; postal_code: string | null; city: string | null } | null;
  supplier_name: string | null;
  supplier_nip: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  payment_due: string | null;
  amount_net: number | null;
  amount_vat: number | null;
  amount_gross: number | null;
  vat_rate: number | null;
  category: string | null;
  line_items: OCRLineItem[];
};

export type OCRInput =
  | { kind: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string }
  | { kind: "pdf"; base64: string };

const SYSTEM_PROMPT = `Jesteś ekspertem od polskich dokumentów kosztowych: faktur VAT, faktur uproszczonych i PARAGONÓW FISKALNYCH (często z NIP nabywcy). Dokument może być zdjęciem zrobionym telefonem lub tabletem: krzywym, pogniecionym, z odblaskiem, ze słabym kontrastem, z kilkoma dokumentami obok siebie. Czytaj bardzo uważnie. Zwróć WYŁĄCZNIE JSON, bez komentarzy, bez markdown.

Schema:
{
  "document_type": "faktura" | "paragon" | "inne",
  "confidence": "high" | "medium" | "low",
  "uncertain": string[],
  "buyer_nip": string | null,
  "supplier_address": { "street": string | null, "postal_code": string | null, "city": string | null } | null,
  "supplier_name": string | null,
  "supplier_nip": string | null,
  "invoice_number": string | null,
  "issue_date": "YYYY-MM-DD" | null,
  "payment_due": "YYYY-MM-DD" | null,
  "amount_net": number | null,
  "amount_vat": number | null,
  "amount_gross": number | null,
  "vat_rate": number | null,
  "category": "płyty/drewno" | "okucia" | "materiały" | "narzędzia" | "usługi" | "transport" | "paliwo" | "biuro" | "inne" | null,
  "line_items": [
    { "description": string, "amount_net": number | null, "amount_vat": number | null, "amount_gross": number, "vat_rate": number | null }
  ]
}

Reguły ogólne:
- supplier_address: adres SPRZEDAWCY z nagłówka dokumentu. street = ulica i numer (np. "ul. Wojewódzka 59"), postal_code w formacie 00-000, city = miejscowość. Pole, którego nie widać, ustaw na null.
- Kwoty jako liczby w PLN. Przecinek dziesiętny zamień na kropkę. Bez separatorów tysięcy.
- Daty zawsze YYYY-MM-DD.
- vat_rate jako ułamek: 23% = 0.23, 8% = 0.08, 5% = 0.05, 0% = 0, "zw"/"np" = 0. Gdy dokument ma kilka stawek, ustaw vat_rate na stawkę o największej wartości sprzedaży, a stawki poszczególnych pozycji podaj w line_items.
- NIP: same cyfry, 10 cyfr, bez "PL" i myślników. Przepisz cyfry dokładnie, nie zgaduj. Jeśli cyfra jest niepewna, wpisz to w "uncertain".
- Jeśli pole nieczytelne lub nieobecne: null. Nigdy nie wymyślaj wartości.
- confidence: "high" tylko gdy NIP, kwota brutto i data są wyraźnie czytelne; "low" gdy zdjęcie jest rozmazane albo ucięte.
- uncertain: krótkie polskie uwagi, np. "ostatnia cyfra NIP sprzedawcy nieczytelna", "kwota brutto częściowo zasłonięta". Pusta lista, gdy wszystko pewne.

PARAGON FISKALNY:
- document_type = "paragon". Sprzedawca to nagłówek na górze (nazwa, adres, "NIP xxx-xxx-xx-xx" sprzedawcy).
- Jeśli na paragonie jest "NIP nabywcy" / "NIP:" w dolnej części / linia z NIP po pozycjach, to jest to NIP NABYWCY (firmy kupującej) i trafia do buyer_nip. NIP sprzedawcy nigdy nie wpisuj do buyer_nip i odwrotnie.
- invoice_number dla paragonu, w tej kolejności: (1) "Nr wydruku" / "Nr paragonu" / "Nr transakcji"; (2) numer w formacie litera+cyfry/cyfry (np. "F0571/126", "F1304/619") w linii BEZPOŚREDNIO NAD napisem "NIP nabywcy" — to jest numer paragonu (po nim bywa "#A013103" i "***": te dopiski pomiń, zwróć samo "F0571/126"); (3) jeśli nie ma ani (1) ani (2): "Nr zamówienia" (krótki numer cyfrowy, np. 10483948; przy dwóch numerach zamówienia weź ten krótszy, cyfrowy); (4) jeśli i tego nie ma: długi unikalny "Numer" z dołu paragonu. Nie bierz numeru kasy ani sklepu, numeru urządzenia fiskalnego "EBI 2101…", kodu skrótu (ciąg hex nad "EBI") ani kodu z QR. Gdy użyłeś (3) lub (4), dopisz do "uncertain": "Brak numeru paragonu, użyto numeru zamówienia". Jeśli nie ma żadnego numeru: null.
- Stawki VAT na paragonie oznaczone literami: A = 23%, B = 8%, C = 5%, D = 0%, E/F = zwolniona. Podsumowanie "Sprzedaż opodatkowana A/B/C" i "Podatek PTU A/B/C" pozwala policzyć amount_vat (suma podatków PTU) oraz amount_net = amount_gross - amount_vat.
- amount_gross to "SUMA PLN" / "DO ZAPŁATY" (nie kwota wpłacona gotówką ani reszta).
- Daty paragonu: data sprzedaży na wydruku.

FAKTURA:
- document_type = "faktura". buyer_nip to NIP nabywcy (sekcja "Nabywca"), supplier_nip to NIP sprzedawcy ("Sprzedawca").
- amount_gross to "Razem do zapłaty" / "Wartość brutto" całej faktury.

category (kontekst: produkcja mebli):
  · "płyty/drewno": płyty MDF/HDF/wiórowe, sklejka, fornir, lite drewno, deski, listwy, lakiery, kleje, bejce, oleje, fronty.
  · "okucia": zawiasy, prowadnice, uchwyty, śruby, kołki, łączniki, magnesy, blumy.
  · "narzędzia": elektronarzędzia, ostrza, frezy, tarcze, akcesoria warsztatowe.
  · "transport": kurier, przewóz, dostawa.
  · "paliwo": stacje benzynowe (Orlen/Shell/BP/Lotos/Circle K/MOL/Moya).
  · "biuro": papier, druk, internet, telefon, kasy fiskalne, oprogramowanie.
  · "usługi": podwykonawcy, lakiernia zewnętrzna, cięcie na CNC, montaż.
  · "materiały": wyłącznie gdy nie pasuje "płyty/drewno" ani "okucia" (np. taśmy, materiały eksploatacyjne, chemia, artykuły z marketu budowlanego).
  · "inne": gdy żadna z powyższych nie pasuje.
- line_items: każda istotna pozycja. Dla paragonu przepisz pozycje z paragonu (nazwa, wartość brutto, stawka). Jeśli dokument jest prosty: jedna pozycja sumująca.
- Sprawdź przed odpowiedzią: suma pozycji powinna być równa amount_gross, a amount_net + amount_vat równe amount_gross. Jeśli się nie zgadza, przeczytaj dokument jeszcze raz i popraw albo wpisz rozbieżność do "uncertain".`;

const USER_PROMPT = "Wyciągnij dane z tego dokumentu (faktura lub paragon) i zwróć WYŁĄCZNIE JSON zgodny ze schemą.";

const OCR_MODEL = "claude-sonnet-5-5";
const OCR_FALLBACK_MODEL = "claude-sonnet-4-6";

export async function ocrInvoice(input: OCRInput): Promise<OCRResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Brak klucza ANTHROPIC_API_KEY w środowisku.");
  const client = new Anthropic({ apiKey });

  const docBlock: ContentBlockParam =
    input.kind === "pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: input.base64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: input.mediaType, data: input.base64 },
        };

  const request = (model: string) =>
    client.messages.create({
      model,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [docBlock, { type: "text", text: USER_PROMPT }],
        },
      ],
    });

  let message;
  try {
    message = await request(OCR_MODEL);
  } catch (e) {
    // Nowszy model niedostępny na tym koncie/kluczu: wracamy do sprawdzonego.
    const status = (e as { status?: number }).status;
    if (status === 404 || status === 400) message = await request(OCR_FALLBACK_MODEL);
    else throw e;
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("OCR: brak odpowiedzi tekstowej od modelu.");
  }
  const raw = textBlock.text.trim();
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as OCRResult;
    return normalize(parsed);
  } catch {
    throw new Error(`OCR: nieprawidłowy JSON od modelu. Fragment: ${raw.slice(0, 160)}`);
  }
}

function normalize(r: OCRResult): OCRResult {
  const digits = (v: unknown) => (v ? String(v).replace(/\D/g, "").replace(/^PL/i, "") || null : null);
  return {
    document_type: r.document_type === "paragon" || r.document_type === "inne" ? r.document_type : "faktura",
    confidence: r.confidence === "high" || r.confidence === "low" ? r.confidence : "medium",
    uncertain: Array.isArray(r.uncertain) ? r.uncertain.map((u) => String(u)).filter(Boolean).slice(0, 6) : [],
    buyer_nip: digits(r.buyer_nip),
    supplier_address: r.supplier_address
      ? {
          street: nullableStr(r.supplier_address.street),
          postal_code: nullableStr(r.supplier_address.postal_code),
          city: nullableStr(r.supplier_address.city),
        }
      : null,
    supplier_name: nullableStr(r.supplier_name),
    supplier_nip: digits(r.supplier_nip),
    invoice_number: nullableStr(r.invoice_number),
    issue_date: nullableStr(r.issue_date),
    payment_due: nullableStr(r.payment_due),
    amount_net: numOrNull(r.amount_net),
    amount_vat: numOrNull(r.amount_vat),
    amount_gross: numOrNull(r.amount_gross),
    vat_rate: numOrNull(r.vat_rate),
    category: nullableStr(r.category),
    line_items: Array.isArray(r.line_items)
      ? r.line_items
          .map((li) => ({
            description: String(li.description ?? "").trim() || "Pozycja",
            amount_net: numOrNull(li.amount_net),
            amount_vat: numOrNull(li.amount_vat),
            amount_gross: numOrNull(li.amount_gross) ?? 0,
            vat_rate: numOrNull(li.vat_rate),
          }))
          .filter((li) => li.amount_gross > 0 || li.description !== "Pozycja")
      : [],
  };
}

function nullableStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
