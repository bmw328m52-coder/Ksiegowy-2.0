"use server";

import { revalidatePath } from "next/cache";
import {
  createChecklistItem,
  updateChecklistItem,
  setChecklistItemStatus as setStatusDao,
  deleteChecklistItemCascade,
  seedChecklistFromTemplate,
  countChecklistByJob,
  syncChecklistItemCostLine,
  type ChecklistItemInput,
  type ChecklistItemStatus,
} from "@/lib/dao/job_checklist";
import {
  CHECKLIST_STATUSES,
  PROJECT_TYPES,
  type ProjectType,
} from "@/lib/dao/job_checklist.types";
import { parseAmount } from "@/lib/format";

type Result = { error?: string };

function readItemForm(formData: FormData, jobId: string): ChecklistItemInput | string {
  const category = String(formData.get("category") ?? "").trim();
  if (!category) return "Podaj kategorię.";
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return "Podaj nazwę pozycji.";

  const qtyRaw = String(formData.get("qty") ?? "").trim();
  const qty = qtyRaw ? parseAmount(qtyRaw) : 1;
  if (qty === null || qty < 0) return "Nieprawidłowa ilość.";

  const unit = String(formData.get("unit") ?? "").trim() || "szt";

  const priceRaw = String(formData.get("unit_price_net") ?? "").trim();
  let unit_price_net: number | null = null;
  if (priceRaw) {
    const parsed = parseAmount(priceRaw);
    if (parsed === null || parsed < 0) return "Nieprawidłowa cena.";
    unit_price_net = parsed;
  }

  const vatPct = Number(formData.get("vat_rate") ?? "23");
  const vat_rate = Number.isFinite(vatPct) ? vatPct / 100 : 0.23;

  const supplier = String(formData.get("supplier") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const counts_in_margin = formData.get("counts_in_margin") === "on";

  return {
    job_id: jobId,
    category,
    label,
    qty,
    unit,
    unit_price_net,
    vat_rate,
    supplier,
    notes,
    counts_in_margin,
  };
}

export async function addChecklistItemAction(
  jobId: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const parsed = readItemForm(formData, jobId);
  if (typeof parsed === "string") return { error: parsed };
  try {
    const created = await createChecklistItem(parsed);
    await syncChecklistItemCostLine(created);
    revalidatePath(`/jobs/${jobId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}

export async function updateChecklistItemAction(
  itemId: string,
  jobId: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const parsed = readItemForm(formData, jobId);
  if (typeof parsed === "string") return { error: parsed };
  try {
    const updated = await updateChecklistItem(itemId, parsed);
    await syncChecklistItemCostLine(updated);
    revalidatePath(`/jobs/${jobId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}

export async function setChecklistItemStatusAction(
  itemId: string,
  jobId: string,
  formData: FormData
) {
  const status = String(formData.get("status") ?? "");
  if (!CHECKLIST_STATUSES.includes(status as ChecklistItemStatus))
    throw new Error("Nieznany status.");
  await setStatusDao(itemId, status as ChecklistItemStatus);
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteChecklistItemAction(itemId: string, jobId: string) {
  await deleteChecklistItemCascade(itemId);
  revalidatePath(`/jobs/${jobId}`);
}

export async function seedChecklistAction(jobId: string, formData: FormData) {
  const type = String(formData.get("project_type") ?? "");
  if (!PROJECT_TYPES.includes(type as ProjectType))
    throw new Error("Nieznany typ projektu.");
  const existing = await countChecklistByJob(jobId);
  if (existing > 0) throw new Error("Checklist już istnieje.");
  await seedChecklistFromTemplate(jobId, type as ProjectType);
  revalidatePath(`/jobs/${jobId}`);
}
