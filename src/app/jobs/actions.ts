"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createJob, updateJob, deleteJob, getJob, type JobInput, type JobStatus } from "@/lib/dao/jobs";
import { JOB_STATUS_WORKFLOW } from "@/lib/dao/jobs.types";
import { parseAmount } from "@/lib/format";
import {
  countChecklistByJob,
  seedChecklistFromTemplate,
} from "@/lib/dao/job_checklist";
import { PROJECT_TYPES, type ProjectType } from "@/lib/dao/job_checklist.types";
import { createBrief, setBriefJob, updateBrief } from "@/lib/dao/quote_briefs";
import type { BriefData } from "@/lib/dao/quote_briefs.types";
import { getBriefSchema } from "@/lib/briefSchema";

type Result = { error?: string };

const STATUSES: JobStatus[] = [
  "new_inquiry",
  "to_measure",
  "after_measure",
  "to_quote",
  "quote_sent",
  "accepted",
  "materials_ordered",
  "in_production",
  "ready_to_install",
  "installed",
  "settled",
  "archived",
  "cancelled",
];

function readJobForm(formData: FormData): JobInput | string {
  const client_id = String(formData.get("client_id") ?? "").trim();
  if (!client_id) return "Brak klienta — dodaj zlecenie z poziomu klienta.";
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return "Podaj tytuł zlecenia.";

  const amountRaw = String(formData.get("amount_gross") ?? "").trim();
  let amount_gross: number;
  if (amountRaw) {
    const parsedAmount = parseAmount(amountRaw);
    if (parsedAmount === null || parsedAmount < 0)
      return "Podaj kwotę brutto (np. 12500 lub 12 500,00).";
    amount_gross = parsedAmount;
  } else {
    amount_gross = 0;
  }

  const vatRaw = String(formData.get("vat_rate") ?? "").trim();
  const vat_pct = vatRaw ? Number(vatRaw) : 23;
  const vat_rate = Number.isFinite(vat_pct) ? vat_pct / 100 : 0.23;

  const statusRaw = String(formData.get("status") ?? "").trim();
  const status = (statusRaw || "to_measure") as JobStatus;
  if (!STATUSES.includes(status)) return "Nieznany status.";

  const start_date = String(formData.get("start_date") ?? "").trim() || null;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  let completed_date = String(formData.get("completed_date") ?? "").trim() || null;
  let paid_date = String(formData.get("paid_date") ?? "").trim() || null;

  const today = new Date().toISOString().slice(0, 10);

  const isInstalledOrLater = status === "installed" || status === "settled" || status === "archived";
  const isPaid = status === "settled" || status === "archived";

  if (isInstalledOrLater && due_date && due_date > today) {
    return "Termin realizacji w przyszłości — nie można oznaczyć jako zamontowane/rozliczone. Zmień datę realizacji albo status.";
  }
  if (isInstalledOrLater) {
    if (!completed_date) completed_date = today;
    if (completed_date > today) return "Data zakończenia w przyszłości — wybierz dzisiejszą lub wcześniejszą.";
    if (isPaid) {
      if (!paid_date) paid_date = today;
      if (paid_date > today) return "Data opłaty w przyszłości — wybierz dzisiejszą lub wcześniejszą.";
    } else {
      paid_date = null;
    }
  } else {
    // wcześniejsze etapy + cancelled → bez dat realizacji i opłaty
    completed_date = null;
    paid_date = null;
  }

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

  const projectTypeRaw = String(formData.get("project_type") ?? "").trim();
  let project_type: ProjectType | null = null;
  if (projectTypeRaw) {
    if (!PROJECT_TYPES.includes(projectTypeRaw as ProjectType))
      return "Nieznany typ projektu.";
    project_type = projectTypeRaw as ProjectType;
  }

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
    project_type,
    notes,
  };
}

async function maybeSeedChecklist(jobId: string, type: ProjectType | null | undefined) {
  if (!type) return;
  const existing = await countChecklistByJob(jobId);
  if (existing > 0) return;
  await seedChecklistFromTemplate(jobId, type);
}

export async function createJobAction(_prev: Result, formData: FormData): Promise<Result> {
  const parsed = readJobForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    const created = await createJob(parsed);
    await maybeSeedChecklist(created.id, parsed.project_type);
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
    await maybeSeedChecklist(id, parsed.project_type);
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
  if (job.due_date && job.due_date > today) {
    throw new Error(
      "Termin realizacji w przyszłości — nie można oznaczyć jako opłacone. Zmień datę realizacji w edycji zlecenia."
    );
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "settled",
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

export async function unmarkJobPaidAction(id: string) {
  const job = await getJob(id);
  if (!job) throw new Error("Zlecenie nie istnieje.");

  const nextStatus: JobStatus = job.completed_date ? "installed" : "in_production";
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      status: nextStatus,
      paid_date: null,
    })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath(`/clients/${job.client_id}`);
  revalidatePath("/dashboard");
}

export async function advanceJobStatusAction(id: string) {
  const job = await getJob(id);
  if (!job) throw new Error("Zlecenie nie istnieje.");
  if (job.status === "cancelled") throw new Error("Zlecenie anulowane — nie można posuwać etapu.");

  const idx = JOB_STATUS_WORKFLOW.indexOf(job.status);
  if (idx < 0) throw new Error("Nieznany status zlecenia.");
  if (idx >= JOB_STATUS_WORKFLOW.length - 1) throw new Error("Zlecenie jest już w archiwum.");

  const next = JOB_STATUS_WORKFLOW[idx + 1];
  const today = new Date().toISOString().slice(0, 10);

  if (next === "installed") {
    if (job.due_date && job.due_date > today) {
      throw new Error("Termin realizacji w przyszłości — edytuj zlecenie, by zmienić datę.");
    }
  }
  if (next === "settled") {
    return markJobPaidAction(id);
  }

  const update: Record<string, unknown> = { status: next };
  if (next === "installed") {
    update.completed_date = job.completed_date ?? today;
  }
  if (next === "accepted" && !job.deposit_date && Number(job.deposit_amount) > 0) {
    update.deposit_date = today;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update(update).eq("id", id);
  if (error) throw error;

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath(`/clients/${job.client_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function revertJobStatusAction(id: string) {
  const job = await getJob(id);
  if (!job) throw new Error("Zlecenie nie istnieje.");
  if (job.status === "settled") {
    return unmarkJobPaidAction(id);
  }
  const idx = JOB_STATUS_WORKFLOW.indexOf(job.status);
  if (idx <= 0) throw new Error("Nie można cofnąć etapu — zlecenie jest na pierwszym etapie.");

  const prev = JOB_STATUS_WORKFLOW[idx - 1];
  const update: Record<string, unknown> = { status: prev };
  if (job.status === "installed") {
    update.completed_date = null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update(update).eq("id", id);
  if (error) throw error;

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath(`/clients/${job.client_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function deleteJobAction(id: string, clientId: string) {
  await deleteJob(id);
  revalidatePath("/jobs");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

function readBriefDataFromForm(formData: FormData, project_type: ProjectType): {
  title: string;
  visit_date: string | null;
  notes: string | null;
  data: BriefData;
} | string {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return "Podaj tytuł pomiaru.";
  const visit_date = String(formData.get("visit_date") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const schema = getBriefSchema(project_type);
  const data: BriefData = {};
  for (const group of schema.groups) {
    for (const field of group.fields) {
      const raw = formData.get(`data.${field.key}`);
      if (field.type === "checkbox") {
        data[field.key] = raw === "on";
        continue;
      }
      if (raw === null) continue;
      const s = String(raw).trim();
      if (s === "") continue;
      if (field.type === "number") {
        const n = parseAmount(s);
        if (n === null) continue;
        data[field.key] = n;
      } else {
        data[field.key] = s;
      }
    }
  }

  return { title, visit_date, notes, data };
}

export async function createPomiarForJobAction(
  jobId: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const job = await getJob(jobId);
  if (!job) return { error: "Pomiar nie istnieje." };

  const projectTypeRaw = String(formData.get("project_type") ?? "").trim();
  if (!PROJECT_TYPES.includes(projectTypeRaw as ProjectType))
    return { error: "Wybierz typ projektu." };
  const project_type = projectTypeRaw as ProjectType;

  const parsed = readBriefDataFromForm(formData, project_type);
  if (typeof parsed === "string") return { error: parsed };

  try {
    const brief = await createBrief({
      client_id: job.client_id,
      project_type,
      title: parsed.title,
      visit_date: parsed.visit_date,
      status: "draft",
      data: parsed.data,
      notes: parsed.notes,
    });
    await setBriefJob(brief.id, jobId);

    const supabase = await createClient();
    const jobUpdate: Record<string, unknown> = {
      title: parsed.title,
      project_type,
      start_date: parsed.visit_date,
      notes: parsed.notes,
    };
    if (job.status === "new_inquiry" || job.status === "to_measure") {
      jobUpdate.status = "after_measure";
    }
    const { error: jobErr } = await supabase
      .from("jobs")
      .update(jobUpdate)
      .eq("id", jobId);
    if (jobErr) throw jobErr;

    await maybeSeedChecklist(jobId, project_type);

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/briefs");
    revalidatePath("/");
    redirect(`/jobs/${jobId}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

export async function updatePomiarAction(
  briefId: string,
  jobId: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const projectTypeRaw = String(formData.get("project_type") ?? "").trim();
  if (!PROJECT_TYPES.includes(projectTypeRaw as ProjectType))
    return { error: "Wybierz typ projektu." };
  const project_type = projectTypeRaw as ProjectType;

  const parsed = readBriefDataFromForm(formData, project_type);
  if (typeof parsed === "string") return { error: parsed };

  try {
    await updateBrief(briefId, {
      project_type,
      title: parsed.title,
      visit_date: parsed.visit_date,
      notes: parsed.notes,
      data: parsed.data,
    });
    // Synchronizuj tylko pola pomiaru na zleceniu — nie ruszaj wyceny / statusu.
    const supabase = await createClient();
    const { error: jobErr } = await supabase
      .from("jobs")
      .update({
        title: parsed.title,
        project_type,
        start_date: parsed.visit_date,
        notes: parsed.notes,
      })
      .eq("id", jobId);
    if (jobErr) throw jobErr;

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    redirect(`/jobs/${jobId}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

// Pomiar = brief + job razem; wycenę dopiszesz później po kalkulatorze.
export async function createPomiarAction(_prev: Result, formData: FormData): Promise<Result> {
  const client_id = String(formData.get("client_id") ?? "").trim();
  if (!client_id) return { error: "Brak klienta — dodaj pomiar z poziomu klienta." };

  const projectTypeRaw = String(formData.get("project_type") ?? "").trim();
  if (!PROJECT_TYPES.includes(projectTypeRaw as ProjectType))
    return { error: "Wybierz typ projektu." };
  const project_type = projectTypeRaw as ProjectType;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Podaj tytuł pomiaru." };

  const visit_date = String(formData.get("visit_date") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const schema = getBriefSchema(project_type);
  const data: BriefData = {};
  for (const group of schema.groups) {
    for (const field of group.fields) {
      const raw = formData.get(`data.${field.key}`);
      if (field.type === "checkbox") {
        data[field.key] = raw === "on";
        continue;
      }
      if (raw === null) continue;
      const s = String(raw).trim();
      if (s === "") continue;
      if (field.type === "number") {
        const n = parseAmount(s);
        if (n === null) continue;
        data[field.key] = n;
      } else {
        data[field.key] = s;
      }
    }
  }

  try {
    const job = await createJob({
      client_id,
      title,
      amount_gross: 0,
      vat_rate: 0.23,
      status: "to_measure",
      start_date: visit_date,
      due_date: null,
      completed_date: null,
      paid_date: null,
      deposit_amount: 0,
      deposit_date: null,
      invoiced: false,
      invoice_number: null,
      invoice_date: null,
      project_type,
      notes,
    });
    await maybeSeedChecklist(job.id, project_type);

    const brief = await createBrief({
      client_id,
      project_type,
      title,
      visit_date,
      status: "draft",
      data,
      notes,
    });
    await setBriefJob(brief.id, job.id);

    revalidatePath("/jobs");
    revalidatePath(`/clients/${client_id}`);
    revalidatePath("/briefs");
    redirect(`/jobs/${job.id}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}
