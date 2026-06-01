"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createInvoiceRow,
  deleteInvoice as daoDeleteInvoice,
  getInvoice,
  updateInvoice,
} from "@/lib/dao/invoices";
import {
  createCostLines,
  deleteCostLine as daoDeleteCostLine,
  updateCostLine,
} from "@/lib/dao/cost_lines";
import { updateCatalogItem } from "@/lib/dao/material_catalog";
import { ocrInvoice, type OCRInput } from "@/lib/ocr/claude";
import { parseAmount } from "@/lib/format";

type Result = { error?: string };

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadAndOcrInvoice(_prev: Result, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Brak sesji." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Wybierz plik faktury (zdjęcie lub PDF)." };
  }
  if (file.size > MAX_BYTES) return { error: "Plik za duży (maks. 10 MB)." };
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return { error: "Akceptujemy tylko PDF, JPG, PNG, WebP." };
  }

  const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1] ?? "bin";
  const fileId = crypto.randomUUID();
  const filePath = `${user.id}/${fileId}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("invoices")
    .upload(filePath, buf, { contentType: mime, upsert: false });
  if (upErr) return { error: `Nie udało się wgrać pliku: ${upErr.message}` };

  let invoiceId: string;
  try {
    const row = await createInvoiceRow({ file_path: filePath, file_mime: mime, ocr_status: "processing" });
    invoiceId = row.id;
  } catch (e) {
    await supabase.storage.from("invoices").remove([filePath]);
    return { error: e instanceof Error ? e.message : "Nieznany błąd zapisu." };
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

    await updateInvoice(invoiceId, {
      ocr_status: "done",
      ocr_raw: ocr,
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
    const items =
      ocr.line_items.length > 0
        ? ocr.line_items.map((li) => ({
            invoice_id: invoiceId,
            description: li.description,
            amount_net: li.amount_net ?? 0,
            amount_vat: li.amount_vat ?? 0,
            amount_gross: li.amount_gross ?? 0,
            vat_rate: li.vat_rate ?? ocr.vat_rate,
            category: ocr.category,
            cost_date: costDate,
          }))
        : ocr.amount_gross && ocr.amount_gross > 0
          ? [
              {
                invoice_id: invoiceId,
                description:
                  [ocr.supplier_name, ocr.invoice_number].filter(Boolean).join(" — ") || "Faktura",
                amount_net: ocr.amount_net ?? 0,
                amount_vat: ocr.amount_vat ?? 0,
                amount_gross: ocr.amount_gross,
                vat_rate: ocr.vat_rate,
                category: ocr.category,
                cost_date: costDate,
              },
            ]
          : [];

    if (items.length > 0) await createCostLines(items);
  } catch (e) {
    await updateInvoice(invoiceId, {
      ocr_status: "failed",
      ocr_raw: { error: e instanceof Error ? e.message : String(e) },
    });
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}?fresh=1`);
}

export async function updateInvoiceAction(
  id: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const supplier_name = strOrNull(formData.get("supplier_name"));
  const supplier_nip = strOrNull(formData.get("supplier_nip"));
  const invoice_number = strOrNull(formData.get("invoice_number"));
  const issue_date = strOrNull(formData.get("issue_date"));
  const payment_due = strOrNull(formData.get("payment_due"));
  const amount_net = parseAmount(String(formData.get("amount_net") ?? ""));
  const amount_vat = parseAmount(String(formData.get("amount_vat") ?? ""));
  const amount_gross = parseAmount(String(formData.get("amount_gross") ?? ""));
  const vat_pct = String(formData.get("vat_rate") ?? "").trim();
  const vat_rate_raw = vat_pct === "" ? null : Number(vat_pct) / 100;
  const vat_rate = Number.isFinite(vat_rate_raw as number) ? (vat_rate_raw as number) : null;
  const notes = strOrNull(formData.get("notes"));

  try {
    const current = await getInvoice(id);
    if (!current) return { error: "Faktura nie istnieje." };

    const changed =
      strChanged(current.supplier_name, supplier_name) ||
      strChanged(current.supplier_nip, supplier_nip) ||
      strChanged(current.invoice_number, invoice_number) ||
      strChanged(current.issue_date, issue_date) ||
      strChanged(current.payment_due, payment_due) ||
      strChanged(current.notes, notes) ||
      numChanged(current.amount_net, amount_net) ||
      numChanged(current.amount_vat, amount_vat) ||
      numChanged(current.amount_gross, amount_gross) ||
      numChanged(current.vat_rate, vat_rate);

    await updateInvoice(id, {
      supplier_name,
      supplier_nip,
      invoice_number,
      issue_date,
      payment_due,
      amount_net,
      amount_vat,
      amount_gross,
      vat_rate,
      notes,
      ...(changed ? { ocr_status: "manual" as const } : {}),
    });
    revalidatePath(`/invoices/${id}`);
    revalidatePath("/invoices");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

export async function deleteInvoiceAction(id: string) {
  await daoDeleteInvoice(id);
  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function assignCostLineAction(lineId: string, formData: FormData) {
  const raw = String(formData.get("job_id") ?? "");
  const job_id = raw === "" || raw === "__none__" ? null : raw;
  await updateCostLine(lineId, { job_id });
  const invoiceId = String(formData.get("invoice_id") ?? "");
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

/**
 * Spina linię kosztu z pozycją katalogu i — jeśli qty>0 oraz brutto>0 —
 * nadpisuje material_catalog.default_price_gross ceną jednostkową z faktury.
 * Dzięki temu kalkulator modułowy używa najświeższych cen z faktur.
 */
export async function assignCostLineCatalogAction(lineId: string, formData: FormData) {
  const rawCat = String(formData.get("catalog_id") ?? "").trim();
  const catalog_id = rawCat === "" || rawCat === "__none__" ? null : rawCat;
  const qty = Math.max(0, parseAmount(String(formData.get("qty") ?? "1")) ?? 1);
  const invoiceId = String(formData.get("invoice_id") ?? "");
  // Nadpisanie ceny w cenniku jest opcjonalne — żeby spięcie linii (np. tylko
  // do przypisania kategorii) nie zmieniało po cichu ceny bazowej materiału.
  const updatePrice = String(formData.get("update_price") ?? "") === "on";

  const updated = await updateCostLine(lineId, { catalog_id, qty });

  if (catalog_id && qty > 0 && updatePrice) {
    const gross = Number(updated.amount_gross);
    if (Number.isFinite(gross) && gross > 0) {
      const unitPrice = Math.round((gross / qty) * 100) / 100;
      try {
        await updateCatalogItem(catalog_id, { default_price_gross: unitPrice });
        revalidatePath("/materials");
      } catch {
        // ignore — przypisanie linii nadal jest zapisane, cena pozostaje
      }
    }
  }

  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export async function updateCostLineAction(
  lineId: string,
  invoiceId: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Opis pozycji jest wymagany." };
  const amount_gross = parseAmount(String(formData.get("amount_gross") ?? ""));
  if (amount_gross === null) return { error: "Podaj kwotę brutto." };
  const amount_net = parseAmount(String(formData.get("amount_net") ?? "")) ?? 0;
  const amount_vat = parseAmount(String(formData.get("amount_vat") ?? "")) ?? 0;
  const qty = Math.max(0, parseAmount(String(formData.get("qty") ?? "1")) ?? 1);
  const vat_pct = String(formData.get("vat_rate") ?? "").trim();
  const vat_rate = vat_pct === "" ? null : Number(vat_pct) / 100;
  const category = strOrNull(formData.get("category"));
  const cost_date = String(formData.get("cost_date") ?? "").trim() || new Date().toISOString().slice(0, 10);

  try {
    await updateCostLine(lineId, {
      description,
      amount_net,
      amount_vat,
      amount_gross,
      qty,
      vat_rate: Number.isFinite(vat_rate as number) ? (vat_rate as number) : null,
      category,
      cost_date,
    });
    revalidatePath(`/invoices/${invoiceId}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

export async function deleteCostLineAction(lineId: string, invoiceId: string) {
  await daoDeleteCostLine(lineId);
  revalidatePath(`/invoices/${invoiceId}`);
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function strChanged(a: string | null, b: string | null): boolean {
  return (a ?? "") !== (b ?? "");
}

function numChanged(a: string | number | null, b: number | null): boolean {
  const aN = a === null || a === "" ? null : Number(a);
  const bN = b === null ? null : Number(b);
  if (aN === null && bN === null) return false;
  if (aN === null || bN === null) return true;
  return Math.abs(aN - bN) > 1e-6;
}
