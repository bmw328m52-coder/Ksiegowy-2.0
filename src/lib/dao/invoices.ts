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

export async function getSignedFileUrl(filePath: string, expiresIn = 60 * 30): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("invoices")
    .createSignedUrl(filePath, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
