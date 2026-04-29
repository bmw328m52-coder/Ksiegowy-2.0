"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createJob, updateJob, deleteJob, getJob, type JobInput, type JobStatus } from "@/lib/dao/jobs";
import { parseAmount } from "@/lib/format";

type Result = { error?: string };

const STATUSES: JobStatus[] = ["planned", "in_progress", "completed", "paid", "cancelled"];

function readJobForm(formData: FormData): JobInput | string {
  const client_id = String(formData.get("client_id") ?? "").trim();
  if (!client_id) return "Brak klienta — dodaj zlecenie z poziomu klienta.";
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return "Podaj tytuł zlecenia.";

  const amount_gross = parseAmount(String(formData.get("amount_gross") ?? ""));
  if (amount_gross === null || amount_gross < 0)
    return "Podaj kwotę brutto (np. 12500 lub 12 500,00).";

  const vat_pct = Number(formData.get("vat_rate") ?? "23");
  const vat_rate = Number.isFinite(vat_pct) ? vat_pct / 100 : 0.23;

  const status = String(formData.get("status") ?? "planned") as JobStatus;
  if (!STATUSES.includes(status)) return "Nieznany status.";

  const start_date = String(formData.get("start_date") ?? "").trim() || null;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const completed_date = String(formData.get("completed_date") ?? "").trim() || null;
  const paid_date = String(formData.get("paid_date") ?? "").trim() || null;

  const depositRaw = String(formData.get("deposit_amount") ?? "").trim();
  const depositParsed = depositRaw ? parseAmount(depositRaw) : 0;
  if (depositParsed === null || depositParsed < 0)
    return "Nieprawidłowa kwota zaliczki/zadatku.";
  if (depositParsed > amount_gross)
    return "Kwota zaliczki nie może przekroczyć kwoty brutto zlecenia.";
  const deposit_date = String(formData.get("deposit_date") ?? "").trim() || null;

  const invoiced = formData.get("invoiced") === "on";
  const invoice_number = invoiced
    ? (String(formData.get("invoice_number") ?? "").trim() || null)
    : null;
  const invoice_date = invoiced
    ? (String(formData.get("invoice_date") ?? "").trim() || null)
    : null;

  const notes = String(formData.get("notes") ?? "").trim() || null;

  return {
    client_id,
    title,
    amount_gross,
    vat_rate,
    status,
    start_date,
    due_date,
    completed_date,
    paid_date,
    deposit_amount: depositParsed,
    deposit_date,
    invoiced,
    invoice_number,
    invoice_date,
    notes,
  };
}

export async function createJobAction(_prev: Result, formData: FormData): Promise<Result> {
  const parsed = readJobForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    const created = await createJob(parsed);
    revalidatePath("/jobs");
    revalidatePath(`/clients/${parsed.client_id}`);
    redirect(`/jobs/${created.id}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

export async function updateJobAction(
  id: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const parsed = readJobForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    await updateJob(id, parsed);
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${id}`);
    revalidatePath(`/clients/${parsed.client_id}`);
    redirect(`/jobs/${id}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

export async function markJobPaidAction(id: string) {
  const job = await getJob(id);
  if (!job) throw new Error("Zlecenie nie istnieje.");

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "paid",
      paid_date: job.paid_date ?? today,
      completed_date: job.completed_date ?? today,
    })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath(`/clients/${job.client_id}`);
  revalidatePath("/dashboard");
}

export async function deleteJobAction(id: string, clientId: string) {
  await deleteJob(id);
  revalidatePath("/jobs");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
