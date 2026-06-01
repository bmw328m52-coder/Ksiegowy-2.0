import { createClient } from "@/lib/supabase/server";
import type {
  MaterialCatalogItem,
  MaterialCatalogInput,
  JobMaterial,
  JobMaterialInput,
} from "./material_catalog.types";

export type {
  MaterialCatalogItem,
  MaterialCatalogInput,
  JobMaterial,
  JobMaterialInput,
} from "./material_catalog.types";

async function uid(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");
  return user.id;
}

// ---------- Katalog ----------

export async function listCatalog(): Promise<MaterialCatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_catalog")
    .select("*")
    .order("category", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeCatalog);
}

export async function listCatalogByCategory(
  category: string,
  unit?: string
): Promise<MaterialCatalogItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("material_catalog")
    .select("*")
    .eq("category", category)
    .order("name", { ascending: true });
  if (unit) query = query.eq("unit", unit);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeCatalog);
}

export async function getCatalogItem(id: string): Promise<MaterialCatalogItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_catalog")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeCatalog(data) : null;
}

export async function createCatalogItem(
  input: MaterialCatalogInput
): Promise<MaterialCatalogItem> {
  const userId = await uid();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_catalog")
    .insert({
      user_id: userId,
      name: input.name,
      unit: input.unit,
      default_price_gross: input.default_price_gross ?? null,
      category: input.category ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeCatalog(data);
}

export async function updateCatalogItem(
  id: string,
  patch: Partial<MaterialCatalogInput>
): Promise<MaterialCatalogItem> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_catalog")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizeCatalog(data);
}

export async function deleteCatalogItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("material_catalog").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Materiały na pomiarze ----------

export async function listMaterialsByJob(jobId: string): Promise<JobMaterial[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_materials")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeJobMat);
}

export async function createJobMaterial(input: JobMaterialInput): Promise<JobMaterial> {
  const userId = await uid();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_materials")
    .insert({
      user_id: userId,
      job_id: input.job_id,
      catalog_id: input.catalog_id ?? null,
      group_key: input.group_key ?? null,
      name: input.name,
      unit: input.unit,
      qty: input.qty,
      unit_price_gross: input.unit_price_gross ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeJobMat(data);
}

export async function updateJobMaterial(
  id: string,
  patch: Partial<JobMaterialInput>
): Promise<JobMaterial> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_materials")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizeJobMat(data);
}

export async function deleteJobMaterial(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_materials").delete().eq("id", id);
  if (error) throw error;
}

function normalizeCatalog(row: Record<string, unknown>): MaterialCatalogItem {
  return {
    ...(row as MaterialCatalogItem),
    default_price_gross:
      row.default_price_gross === null || row.default_price_gross === undefined
        ? null
        : Number(row.default_price_gross),
  };
}

function normalizeJobMat(row: Record<string, unknown>): JobMaterial {
  return {
    ...(row as JobMaterial),
    qty: Number(row.qty ?? 0),
    unit_price_gross:
      row.unit_price_gross === null || row.unit_price_gross === undefined
        ? null
        : Number(row.unit_price_gross),
  };
}
