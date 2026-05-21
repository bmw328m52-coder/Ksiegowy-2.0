"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBrief,
  updateBrief,
  deleteBrief,
  setBriefStatus,
  setBriefJob,
  getBrief,
  type BriefData,
  type QuoteBriefInput,
  type QuoteBriefStatus,
} from "@/lib/dao/quote_briefs";
import { QUOTE_BRIEF_STATUSES } from "@/lib/dao/quote_briefs.types";
import { PROJECT_TYPES, type ProjectType } from "@/lib/dao/job_checklist.types";
import { getBriefSchema } from "@/lib/briefSchema";
import { parseAmount } from "@/lib/format";
import { createJob } from "@/lib/dao/jobs";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";

type Result = { error?: string };

function readBriefForm(formData: FormData): QuoteBriefInput | string {
  const client_id = String(formData.get("client_id") ?? "").trim();
  if (!client_id) return "Brak klienta.";

  const projectTypeRaw = String(formData.get("project_type") ?? "").trim();
  if (!PROJECT_TYPES.includes(projectTypeRaw as ProjectType))
    return "Wybierz typ projektu.";
  const project_type = projectTypeRaw as ProjectType;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return "Podaj tytuł briefu.";

  const visit_date = String(formData.get("visit_date") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const estRaw = String(formData.get("estimated_amount") ?? "").trim();
  let estimated_amount: number | null = null;
  if (estRaw) {
    const parsed = parseAmount(estRaw);
    if (parsed === null || parsed < 0) return "Nieprawidłowa kwota wstępnej wyceny.";
    estimated_amount = parsed;
  }

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

  return {
    client_id,
    project_type,
    title,
    visit_date,
    notes,
    estimated_amount,
    data,
  };
}

export async function createBriefAction(
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const parsed = readBriefForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    const created = await createBrief(parsed);
    revalidatePath(`/clients/${parsed.client_id}`);
    revalidatePath("/briefs");
    redirect(`/briefs/${created.id}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

export async function updateBriefAction(
  id: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const parsed = readBriefForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    await updateBrief(id, parsed);
    revalidatePath(`/clients/${parsed.client_id}`);
    revalidatePath(`/briefs/${id}`);
    revalidatePath("/briefs");
    redirect(`/briefs/${id}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

export async function setBriefStatusAction(
  id: string,
  formData: FormData
) {
  const status = String(formData.get("status") ?? "");
  if (!QUOTE_BRIEF_STATUSES.includes(status as QuoteBriefStatus))
    throw new Error("Nieznany status.");
  await setBriefStatus(id, status as QuoteBriefStatus);
  revalidatePath(`/briefs/${id}`);
  revalidatePath("/briefs");
}

export async function deleteBriefAction(id: string) {
  const brief = await getBrief(id);
  await deleteBrief(id);
  if (brief) revalidatePath(`/clients/${brief.client_id}`);
  revalidatePath("/briefs");
  redirect("/briefs");
}

export async function convertBriefToJobAction(id: string) {
  const brief = await getBrief(id);
  if (!brief) throw new Error("Brief nie istnieje.");
  if (brief.job_id) throw new Error("Brief ma już utworzone zlecenie.");

  const amount_gross = brief.estimated_amount ?? 0;
  const settings = await getUserSettingsOrDefault();
  const created = await createJob({
    client_id: brief.client_id,
    title: brief.title,
    amount_gross,
    vat_rate: settings.default_vat_rate,
    status: "to_quote",
    start_date: null,
    due_date: null,
    completed_date: null,
    paid_date: null,
    deposit_amount: 0,
    deposit_date: null,
    invoiced: false,
    invoice_number: null,
    invoice_date: null,
    project_type: brief.project_type,
    notes: brief.notes,
  });
  await setBriefJob(id, created.id);

  revalidatePath(`/briefs/${id}`);
  revalidatePath(`/clients/${brief.client_id}`);
  revalidatePath("/briefs");
  revalidatePath("/jobs");
  redirect(`/jobs/${created.id}`);
}
