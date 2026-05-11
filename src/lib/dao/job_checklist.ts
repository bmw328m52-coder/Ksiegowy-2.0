import { createClient } from "@/lib/supabase/server";
import type {
  ChecklistItem,
  ChecklistItemInput,
  ChecklistItemStatus,
} from "./job_checklist.types";
import { getTemplateFor } from "@/lib/checklistTemplates";
import type { ProjectType } from "./job_checklist.types";

export type {
  ChecklistItem,
  ChecklistItemInput,
  ChecklistItemStatus,
  ProjectType,
} from "./job_checklist.types";
export {
  CHECKLIST_STATUSES,
  CHECKLIST_STATUS_LABELS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
} from "./job_checklist.types";

async function uid(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");
  return user.id;
}

export async function listChecklistByJob(jobId: string): Promise<ChecklistItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_checklist_items")
    .select("*")
    .eq("job_id", jobId)
    .order("order_idx", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ChecklistItem[]).map(normalize);
}

async function nextOrderIdx(jobId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_checklist_items")
    .select("order_idx")
    .eq("job_id", jobId)
    .order("order_idx", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const cur = data ? Number((data as { order_idx: number }).order_idx) : -1;
  return cur + 1;
}

export async function createChecklistItem(input: ChecklistItemInput): Promise<ChecklistItem> {
  const userId = await uid();
  const supabase = await createClient();
  const order_idx = input.order_idx ?? (await nextOrderIdx(input.job_id));
  const { data, error } = await supabase
    .from("job_checklist_items")
    .insert({
      user_id: userId,
      job_id: input.job_id,
      category: input.category,
      label: input.label,
      qty: input.qty ?? 1,
      unit: input.unit ?? "szt",
      unit_price_net: input.unit_price_net ?? null,
      vat_rate: input.vat_rate ?? 0.23,
      supplier: input.supplier ?? null,
      notes: input.notes ?? null,
      status: input.status ?? "pending",
      counts_in_margin: input.counts_in_margin ?? false,
      order_idx,
    })
    .select()
    .single();
  if (error) throw error;
  return normalize(data as ChecklistItem);
}

export async function updateChecklistItem(
  id: string,
  patch: Partial<ChecklistItemInput>
): Promise<ChecklistItem> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_checklist_items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalize(data as ChecklistItem);
}

export async function setChecklistItemStatus(
  id: string,
  status: ChecklistItemStatus
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_checklist_items")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function setChecklistItemCostLineId(
  id: string,
  costLineId: string | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_checklist_items")
    .update({ cost_line_id: costLineId })
    .eq("id", id);
  if (error) throw error;
}

export async function getChecklistItem(id: string): Promise<ChecklistItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_checklist_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data as ChecklistItem) : null;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_checklist_items").delete().eq("id", id);
  if (error) throw error;
}

function mapChecklistCategoryToCostCategory(checklistCategory: string): string {
  const lc = checklistCategory.toLowerCase();
  if (lc.includes("pomiar") || lc.includes("montaż") || lc.includes("kontrola"))
    return "usługi";
  if (lc.includes("płyt") || lc.includes("front") || lc.includes("blat"))
    return "płyty/drewno";
  if (lc.includes("okuc") || lc.includes("organ")) return "okucia";
  if (lc.includes("transport")) return "transport";
  return "materiały";
}

export async function syncChecklistItemCostLine(item: ChecklistItem): Promise<ChecklistItem> {
  const supabase = await createClient();
  const shouldHaveCostLine =
    item.counts_in_margin &&
    item.unit_price_net !== null &&
    item.unit_price_net > 0 &&
    item.qty > 0;

  if (!shouldHaveCostLine) {
    if (!item.cost_line_id) return item;
    const { error: delErr } = await supabase
      .from("cost_lines")
      .delete()
      .eq("id", item.cost_line_id);
    if (delErr) throw delErr;
    const { data, error } = await supabase
      .from("job_checklist_items")
      .update({ cost_line_id: null })
      .eq("id", item.id)
      .select()
      .single();
    if (error) throw error;
    return normalize(data as ChecklistItem);
  }

  const unitPrice = item.unit_price_net as number;
  const amount_net = Number((item.qty * unitPrice).toFixed(2));
  const amount_vat = Number((amount_net * item.vat_rate).toFixed(2));
  const amount_gross = Number((amount_net + amount_vat).toFixed(2));
  const description = `Checklist: ${item.category} — ${item.label}`;
  const category = mapChecklistCategoryToCostCategory(item.category);

  if (item.cost_line_id) {
    const { error } = await supabase
      .from("cost_lines")
      .update({
        description,
        amount_net,
        amount_vat,
        amount_gross,
        vat_rate: item.vat_rate,
        category,
      })
      .eq("id", item.cost_line_id);
    if (error) throw error;
    return item;
  }

  const userId = await uid();
  const cost_date = new Date().toISOString().slice(0, 10);
  const { data: newCl, error: clErr } = await supabase
    .from("cost_lines")
    .insert({
      user_id: userId,
      invoice_id: null,
      job_id: item.job_id,
      description,
      amount_net,
      amount_vat,
      amount_gross,
      vat_rate: item.vat_rate,
      category,
      cost_date,
    })
    .select("id")
    .single();
  if (clErr) throw clErr;

  const { data: updated, error: updErr } = await supabase
    .from("job_checklist_items")
    .update({ cost_line_id: (newCl as { id: string }).id })
    .eq("id", item.id)
    .select()
    .single();
  if (updErr) throw updErr;
  return normalize(updated as ChecklistItem);
}

export async function deleteChecklistItemCascade(id: string): Promise<void> {
  const supabase = await createClient();
  const item = await getChecklistItem(id);
  if (item?.cost_line_id) {
    const { error } = await supabase
      .from("cost_lines")
      .delete()
      .eq("id", item.cost_line_id);
    if (error) throw error;
  }
  const { error } = await supabase.from("job_checklist_items").delete().eq("id", id);
  if (error) throw error;
}

export async function seedChecklistFromTemplate(
  jobId: string,
  type: ProjectType
): Promise<number> {
  const userId = await uid();
  const supabase = await createClient();
  const tmpl = getTemplateFor(type);
  if (tmpl.length === 0) return 0;

  const rows = tmpl.map((it, idx) => ({
    user_id: userId,
    job_id: jobId,
    category: it.category,
    label: it.label,
    qty: it.qty ?? 1,
    unit: it.unit ?? "szt",
    vat_rate: 0.23,
    status: "pending" as const,
    counts_in_margin: false,
    order_idx: idx,
  }));

  const { error } = await supabase.from("job_checklist_items").insert(rows);
  if (error) throw error;
  return rows.length;
}

export async function countChecklistByJob(jobId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("job_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  if (error) throw error;
  return count ?? 0;
}

export type ChecklistProgress = {
  total: number;
  installed: number;
  active: number; // ordered + delivered + installed (all that left "pending")
};

export async function getChecklistProgressMap(
  jobIds: string[]
): Promise<Map<string, ChecklistProgress>> {
  const out = new Map<string, ChecklistProgress>();
  if (jobIds.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_checklist_items")
    .select("job_id, status")
    .in("job_id", jobIds);
  if (error) throw error;
  for (const row of (data ?? []) as { job_id: string; status: ChecklistItemStatus }[]) {
    const cur = out.get(row.job_id) ?? { total: 0, installed: 0, active: 0 };
    cur.total += 1;
    if (row.status === "installed") cur.installed += 1;
    if (row.status !== "pending") cur.active += 1;
    out.set(row.job_id, cur);
  }
  return out;
}

function normalize(row: ChecklistItem): ChecklistItem {
  return {
    ...row,
    qty: Number(row.qty),
    unit_price_net: row.unit_price_net === null ? null : Number(row.unit_price_net),
    vat_rate: Number(row.vat_rate),
    order_idx: Number(row.order_idx),
  };
}
