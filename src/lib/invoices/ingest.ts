import { createClient } from "@/lib/supabase/server";
import { createInvoiceRow, updateInvoice } from "@/lib/dao/invoices";
import { createCostLines } from "@/lib/dao/cost_lines";
import { suggestedVatDeduction } from "@/lib/dao/cost_lines.types";
import { ocrInvoice, type OCRInput, type OCRResult } from "@/lib/ocr/claude";

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
export const MAX_BYTES = 10 * 1024 * 1024;

export type IngestSummary = {
  id: string;
  docType: "faktura" | "paragon" | "inne";
  supplier_name: string | null;
  supplier_nip: string | null;
  buyer_nip: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  amount_gross: number | null;
  confidence: "high" | "medium" | "low";
  warnings: string[];
  duplicateOf: string | null;
};

export type IngestResult =
  | ({ ok: true } & IngestSummary)
  | { ok: false; error: string; id?: string };

/** Suma kontrolna polskiego NIP (10 cyfr). */
export function isValidNip(nip: string | null | undefined): boolean {
  if (!nip || !/^\d{10}$/.test(nip)) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((acc, wi, i) => acc + wi * Number(nip[i]), 0);
  const check = sum % 11;
  return check !== 10 && check === Number(nip[9]);
}

function buildWarnings(ocr: OCRResult): string[] {
  const w: string[] = [];
  const isReceipt = ocr.document_type === "paragon";
  if (ocr.amount_gross === null || ocr.amount_gross <= 0) w.push("Nie odczytano kwoty brutto.");
  if (!ocr.supplier_nip) w.push("Brak NIP sprzedawcy.");
  else if (!isValidNip(ocr.supplier_nip)) w.push("NIP sprzedawcy ma błędną sumę kontrolną, sprawdź cyfry.");
  if (isReceipt && !ocr.buyer_nip) w.push("Na paragonie nie widać NIP nabywcy.");
  if (ocr.buyer_nip && !isValidNip(ocr.buyer_nip)) w.push("NIP nabywcy ma błędną sumę kontrolną, sprawdź cyfry.");
  if (!ocr.issue_date) w.push("Brak daty dokumentu.");
  else {
    const d = new Date(ocr.issue_date + "T00:00:00");
    if (Number.isNaN(d.getTime())) w.push("Data dokumentu jest nieprawidłowa.");
    else if (d.getTime() > Date.now() + 2 * 86_400_000) w.push("Data dokumentu jest z przyszłości.");
  }
  if (ocr.amount_net !== null && ocr.amount_vat !== null && ocr.amount_gross !== null) {
    if (Math.abs(ocr.amount_net + ocr.amount_vat - ocr.amount_gross) > 0.05) {
      w.push("Netto + VAT nie równa się brutto.");
    }
  }
  if (ocr.line_items.length > 1 && ocr.amount_gross !== null) {
    const sum = ocr.line_items.reduce((a, li) => a + li.amount_gross, 0);
    if (Math.abs(sum - ocr.amount_gross) > 0.05) w.push("Suma pozycji różni się od kwoty brutto.");
  }
  if (ocr.confidence === "low") w.push("Niska pewność odczytu, zrób wyraźniejsze zdjęcie.");
  for (const u of ocr.uncertain) w.push(u);
  return w;
}

async function findDuplicate(
  newId: string,
  ocr: OCRResult,
): Promise<string | null> {
  if (!ocr.supplier_nip) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, issue_date, amount_gross")
    .eq("supplier_nip", ocr.supplier_nip)
    .neq("id", newId)
    .limit(200);
  for (const r of (data ?? []) as {
    id: string;
    invoice_number: string | null;
    issue_date: string | null;
    amount_gross: string | null;
  }[]) {
    const sameNumber = !!ocr.invoice_number && r.invoice_number === ocr.invoice_number;
    const sameDateAmount =
      !!ocr.issue_date &&
      r.issue_date === ocr.issue_date &&
      ocr.amount_gross !== null &&
      Math.abs(Number(r.amount_gross) - ocr.amount_gross) < 0.01;
    if (sameNumber || sameDateAmount) return r.id;
  }
  return null;
}

/**
 * Wgrywa jeden dokument (zdjęcie lub PDF), odczytuje go modelem i zapisuje fakturę z pozycjami kosztów.
 * Wspólne dla pojedynczego wgrania (server action) i skanowania wielu dokumentów (API).
 */
export async function ingestInvoiceFile(file: File): Promise<IngestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Brak sesji. Zaloguj się ponownie." };

  if (file.size === 0) return { ok: false, error: "Pusty plik." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Plik za duży (maks. 10 MB)." };
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) return { ok: false, error: "Akceptujemy tylko PDF, JPG, PNG, WebP." };

  const ext = mime === "application/pdf" ? "pdf" : (mime.split("/")[1] ?? "bin");
  const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("invoices")
    .upload(filePath, buf, { contentType: mime, upsert: false });
  if (upErr) return { ok: false, error: `Nie udało się wgrać pliku: ${upErr.message}` };

  let invoiceId: string;
  try {
    const row = await createInvoiceRow({ file_path: filePath, file_mime: mime, ocr_status: "processing" });
    invoiceId = row.id;
  } catch (e) {
    await supabase.storage.from("invoices").remove([filePath]);
    return { ok: false, error: e instanceof Error ? e.message : "Nieznany błąd zapisu." };
  }

  try {
    const ocrInput: OCRInput =
      mime === "application/pdf"
        ? { kind: "pdf", base64: buf.toString("base64") }
        : {
            kind: "image",
            mediaType: mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            base64: buf.toString("base64"),
          };

    const ocr = await ocrInvoice(ocrInput);
    const warnings = buildWarnings(ocr);
    const duplicateOf = await findDuplicate(invoiceId, ocr);
    if (duplicateOf) warnings.unshift("Taki dokument już jest w aplikacji (ten sam sprzedawca i numer lub data i kwota).");

    await updateInvoice(invoiceId, {
      ocr_status: "done",
      ocr_raw: { ...ocr, warnings },
      // Dokumenty ze skanera (paragony, faktury zapłacone przy zakupie) są od razu zapłacone.
      payment_status: "paid",
      paid_date: ocr.issue_date ?? new Date().toISOString().slice(0, 10),
      doc_source: ocr.document_type === "paragon" ? "receipt" : mime === "application/pdf" ? "pdf" : "photo",
      supplier_name: ocr.supplier_name,
      supplier_nip: ocr.supplier_nip,
      invoice_number: ocr.invoice_number,
      issue_date: ocr.issue_date,
      payment_due: ocr.payment_due,
      amount_net: ocr.amount_net,
      amount_vat: ocr.amount_vat,
      amount_gross: ocr.amount_gross,
      vat_rate: ocr.vat_rate,
    });

    const costDate = ocr.issue_date ?? new Date().toISOString().slice(0, 10);
    const fallbackDescription =
      [ocr.supplier_name, ocr.invoice_number].filter(Boolean).join(" — ") ||
      (ocr.document_type === "paragon" ? "Paragon" : "Faktura");
    const items =
      ocr.line_items.length > 0
        ? ocr.line_items.map((li) => {
            // Paragony zwykle podają tylko brutto i literę stawki: netto i VAT dopełniamy z kwoty brutto.
            const rate = li.vat_rate ?? ocr.vat_rate;
            const gross = li.amount_gross ?? 0;
            const net = li.amount_net ?? (rate !== null ? Math.round((gross / (1 + rate)) * 100) / 100 : gross);
            const vat = li.amount_vat ?? Math.round((gross - net) * 100) / 100;
            return {
              invoice_id: invoiceId,
              description: li.description,
              amount_net: net,
              amount_vat: vat,
              amount_gross: gross,
              vat_rate: rate,
              category: ocr.category,
              cost_date: costDate,
              vat_deduction: suggestedVatDeduction(ocr.category),
            };
          })
        : ocr.amount_gross && ocr.amount_gross > 0
          ? [
              {
                invoice_id: invoiceId,
                description: fallbackDescription,
                amount_net: ocr.amount_net ?? 0,
                amount_vat: ocr.amount_vat ?? 0,
                amount_gross: ocr.amount_gross,
                vat_rate: ocr.vat_rate,
                category: ocr.category,
                cost_date: costDate,
                vat_deduction: suggestedVatDeduction(ocr.category),
              },
            ]
          : [];

    if (items.length > 0) await createCostLines(items);

    return {
      ok: true,
      id: invoiceId,
      docType: ocr.document_type,
      supplier_name: ocr.supplier_name,
      supplier_nip: ocr.supplier_nip,
      buyer_nip: ocr.buyer_nip,
      invoice_number: ocr.invoice_number,
      issue_date: ocr.issue_date,
      amount_gross: ocr.amount_gross,
      confidence: ocr.confidence,
      warnings,
      duplicateOf,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await updateInvoice(invoiceId, { ocr_status: "failed", ocr_raw: { error: message } });
    return { ok: false, id: invoiceId, error: "Nie udało się odczytać dokumentu. Możesz go poprawić ręcznie." };
  }
}
