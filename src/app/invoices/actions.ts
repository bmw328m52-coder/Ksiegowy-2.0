"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  deleteInvoice as daoDeleteInvoice,
  getInvoice,
  updateInvoice,
} from "@/lib/dao/invoices";
import {
  deleteCostLine as daoDeleteCostLine,
  updateCostLine,
  setInvoiceVatDeduction,
} from "@/lib/dao/cost_lines";
import { updateCatalogItem } from "@/lib/dao/material_catalog";
import { ingestInvoiceFile } from "@/lib/invoices/ingest";
import { parseAmount } from "@/lib/format";

type Result = { error?: string };

export async function uploadAndOcrInvoice(_prev: Result, formData: FormData): Promise<Result> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Wybierz plik faktury (zdjęcie lub PDF)." };
  }
  const result = await ingestInvoiceFile(file);
  revalidatePath("/invoices");
  if (!result.ok && !result.id) return { error: result.error };
  redirect(`/invoices/${result.id}?fresh=1`);
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

/** Przypina wszystkie pozycje faktury do jednego zlecenia (lub zdejmuje → koszt ogólny). */
export async function assignInvoiceToJobAction(formData: FormData) {
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const raw = String(formData.get("job_id") ?? "");
  if (!invoiceId || raw === "__mixed__") return;
  const job_id = raw === "" || raw === "__none__" ? null : raw;
  const supabase = await createClient();
  const { data: prev } = await supabase
    .from("cost_lines")
    .select("job_id")
    .eq("invoice_id", invoiceId);
  const { error } = await supabase.from("cost_lines").update({ job_id }).eq("invoice_id", invoiceId);
  if (error) throw error;
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  const touched = new Set<string>([...(prev ?? []).map((r) => r.job_id as string | null), job_id].filter(
    (x): x is string => !!x,
  ));
  for (const id of touched) revalidatePath(`/jobs/${id}`);
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

export async function setInvoiceVatDeductionAction(formData: FormData) {
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const raw = Number(formData.get("vat_deduction"));
  if (!invoiceId || ![0, 50, 100].includes(raw)) return;
  await setInvoiceVatDeduction(invoiceId, raw);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/dashboard");
  revalidatePath("/finanse");
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

/** Zapisuje, które faktury zostały sfinansowane dotacją (ekran /invoices/dotacja). */
export async function setGrantInvoicesAction(ids: string[]): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Brak sesji." };

  const { error: clearErr } = await supabase
    .from("invoices")
    .update({ funded_by_grant: false })
    .eq("user_id", user.id)
    .eq("funded_by_grant", true);
  if (clearErr) return { error: clearErr.message };
  if (ids.length > 0) {
    const { error } = await supabase.from("invoices").update({ funded_by_grant: true }).in("id", ids);
    if (error) return { error: error.message };
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/finanse");
  revalidatePath("/");
  return {};
}

export async function toggleInvoiceGrantAction(formData: FormData) {
  const id = String(formData.get("invoice_id") ?? "");
  const on = String(formData.get("funded_by_grant") ?? "") === "1";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("invoices").update({ funded_by_grant: on }).eq("id", id);
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}
