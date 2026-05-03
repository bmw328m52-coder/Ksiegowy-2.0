import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceUpdate, OCRStatus } from "./invoices.types";

export type { Invoice, InvoiceUpdate, OCRStatus } from "./invoices.types";
export { OCR_STATUS_LABELS } from "./invoices.types";

export async function listInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("issue_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invoice[];
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Invoice | null;
}

export async function createInvoiceRow(input: {
  file_path: string;
  file_mime: string | null;
  ocr_status?: OCRStatus;
}): Promise<Invoice> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      file_path: input.file_path,
      file_mime: input.file_mime,
      ocr_status: input.ocr_status ?? "processing",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function updateInvoice(
  id: string,
  patch: InvoiceUpdate & {
    ocr_status?: OCRStatus;
    ocr_raw?: unknown;
  }
): Promise<Invoice> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("invoices")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
  if (row?.file_path) {
    await supabase.storage.from("invoices").remove([row.file_path]);
  }
}

export type DuplicateMatch = {
  id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  amount_gross: string | null;
  reason: "nip_number" | "supplier_amount_date";
};

export async function findInvoiceDuplicates(invoice: Invoice): Promise<DuplicateMatch[]> {
  const supabase = await createClient();
  const found = new Map<string, DuplicateMatch>();

  if (invoice.supplier_nip && invoice.invoice_number) {
    const { data } = await supabase
      .from("invoices")
      .select("id, supplier_name, invoice_number, issue_date, amount_gross")
      .eq("supplier_nip", invoice.supplier_nip)
      .eq("invoice_number", invoice.invoice_number)
      .neq("id", invoice.id);
    for (const row of (data ?? []) as Omit<DuplicateMatch, "reason">[]) {
      found.set(row.id, { ...row, reason: "nip_number" });
    }
  }

  if (invoice.supplier_name && invoice.amount_gross && invoice.issue_date) {
    const { data } = await supabase
      .from("invoices")
      .select("id, supplier_name, invoice_number, issue_date, amount_gross")
      .eq("supplier_name", invoice.supplier_name)
      .eq("amount_gross", invoice.amount_gross)
      .eq("issue_date", invoice.issue_date)
      .neq("id", invoice.id);
    for (const row of (data ?? []) as Omit<DuplicateMatch, "reason">[]) {
      if (!found.has(row.id)) {
        found.set(row.id, { ...row, reason: "supplier_amount_date" });
      }
    }
  }

  return Array.from(found.values());
}

export async function getSignedFileUrl(filePath: string, expiresIn = 60 * 30): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("invoices")
    .createSignedUrl(filePath, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function getSignedThumbnailUrl(
  filePath: string,
  expiresIn = 60 * 30
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("invoices")
    .createSignedUrl(filePath, expiresIn, {
      transform: { width: 160, height: 160, resize: "cover" },
    });
  if (error) return null;
  return data?.signedUrl ?? null;
}
