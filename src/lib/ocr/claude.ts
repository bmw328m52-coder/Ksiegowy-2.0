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

const SYSTEM_PROMPT = `Jesteś ekspertem od polskich faktur kosztowych. Z dostarczonego dokumentu wyciągnij dane do JSON. Zwróć WYŁĄCZNIE JSON, bez komentarzy, bez markdown.

Schema:
{
  "supplier_name": string | null,
  "supplier_nip": string | null,
  "invoice_number": string | null,
  "issue_date": "YYYY-MM-DD" | null,
  "payment_due": "YYYY-MM-DD" | null,
  "amount_net": number | null,
  "amount_vat": number | null,
  "amount_gross": number | null,
  "vat_rate": number | null,
  "category": "materiały" | "usługi" | "transport" | "narzędzia" | "biuro" | "paliwo" | "inne" | null,
  "line_items": [
    { "description": string, "amount_net": number | null, "amount_vat": number | null, "amount_gross": number, "vat_rate": number | null }
  ]
}

Reguły:
- Kwoty jako liczby w PLN. Przecinek dziesiętny zamień na kropkę. Bez separatorów tysięcy.
- Daty zawsze YYYY-MM-DD.
- vat_rate jako ułamek: 23% = 0.23, 8% = 0.08, 5% = 0.05, 0% = 0, "zw"/"np" = 0.
- supplier_nip: same cyfry, bez "PL" i myślników.
- Jeśli pole nieczytelne lub nieobecne — null.
- category: dobierz po treści ("materiały" dla płyt/okuć/akcesoriów, "narzędzia" dla elektronarzędzi, "transport" dla kurierów/przewozu, "paliwo" dla stacji, "biuro" dla papieru/druku, "usługi" dla podwykonawców).
- line_items: każda istotna pozycja faktury. Jeśli faktura jest prosta — jedna pozycja sumująca.`;

const USER_PROMPT = "Wyciągnij dane z tej faktury i zwróć WYŁĄCZNIE JSON zgodny ze schemą.";

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

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [docBlock, { type: "text", text: USER_PROMPT }],
      },
    ],
  });

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
  return {
    supplier_name: nullableStr(r.supplier_name),
    supplier_nip: r.supplier_nip ? String(r.supplier_nip).replace(/\D/g, "") || null : null,
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
