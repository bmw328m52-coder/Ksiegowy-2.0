import { createClient } from "@/lib/supabase/server";
import type { CostLine, CostLineInput } from "./cost_lines.types";

export type { CostLine, CostLineInput, CostCategory } from "./cost_lines.types";
export { COST_CATEGORIES } from "./cost_lines.types";

export async function listInvoiceCategoriesMap(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_lines")
    .select("invoice_id, category");
  if (error) throw error;
  const tmp: Record<string, Set<string>> = {};
  for (const row of (data ?? []) as { invoice_id: string | null; category: string | null }[]) {
    if (!row.invoice_id || !row.category) continue;
    if (!tmp[row.invoice_id]) tmp[row.invoice_id] = new Set();
    tmp[row.invoice_id].add(row.category);
  }
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(tmp)) out[k] = Array.from(v);
  return out;
}

export async function listCostLinesByInvoice(invoiceId: string): Promise<CostLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_lines")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CostLine[];
}

export async function listCostLinesByJob(jobId: string): Promise<CostLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_lines")
    .select("*")
    .eq("job_id", jobId)
    .order("cost_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CostLine[];
}

export type ClientMaterialCost = CostLine & {
  job_title: string | null;
  invoice_supplier: string | null;
};

export async function listMaterialCostsByClient(clientId: string): Promise<ClientMaterialCost[]> {
  const supabase = await createClient();

  const jobsRes = await supabase
    .from("jobs")
    .select("id, title")
    .eq("client_id", clientId);
  if (jobsRes.error) throw jobsRes.error;

  const jobsList = (jobsRes.data ?? []) as { id: string; title: string }[];
  if (jobsList.length === 0) return [];

  const jobIds = jobsList.map((j) => j.id);
  const jobMap = new Map(jobsList.map((j) => [j.id, j.title]));

  const costsRes = await supabase
    .from("cost_lines")
    .select("*, invoices(supplier_name)")
    .in("job_id", jobIds)
    .eq("category", "materiały")
    .order("cost_date", { ascending: false });
  if (costsRes.error) throw costsRes.error;

  return ((costsRes.data ?? []) as (CostLine & { invoices: { supplier_name: string | null } | null })[]).map(
    (row) => ({
      ...row,
      job_title: row.job_id ? jobMap.get(row.job_id) ?? null : null,
      invoice_supplier: row.invoices?.supplier_name ?? null,
    })
  );
}

export async function createCostLines(inputs: CostLineInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");

  const rows = inputs.map((i) => ({ ...i, user_id: user.id }));
  const { error } = await supabase.from("cost_lines").insert(rows);
  if (error) throw error;
}

export async function updateCostLine(
  id: string,
  patch: Partial<CostLineInput>
): Promise<CostLine> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_lines")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CostLine;
}

export async function deleteCostLine(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_lines").delete().eq("id", id);
  if (error) throw error;
}
