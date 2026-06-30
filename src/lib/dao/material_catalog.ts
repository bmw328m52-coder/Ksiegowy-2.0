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
      supplier: input.supplier ?? null,
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

/**
 * Masowy import pozycji do katalogu. Pomija pozycje, których nazwa już istnieje
 * u tego użytkownika (porównanie case-insensitive), żeby ponowny import nie
 * tworzył duplikatów. Zwraca ile dodano i ile pominięto.
 */
export async function bulkCreateCatalogItems(
  items: MaterialCatalogInput[]
): Promise<{ inserted: number; skipped: number }> {
  const userId = await uid();
  const supabase = await createClient();

  const { data: existing, error: exErr } = await supabase
    .from("material_catalog")
    .select("name")
    .eq("user_id", userId);
  if (exErr) throw exErr;

  const have = new Set(
    (existing ?? []).map((r) => String(r.name ?? "").trim().toLowerCase())
  );
  const toInsert = items.filter(
    (it) => !have.has(it.name.trim().toLowerCase())
  );
  if (toInsert.length === 0) return { inserted: 0, skipped: items.length };

  const rows = toInsert.map((it) => ({
    user_id: userId,
    name: it.name,
    unit: it.unit,
    default_price_gross: it.default_price_gross ?? null,
    category: it.category ?? null,
    supplier: it.supplier ?? null,
    notes: it.notes ?? null,
  }));
  const { error } = await supabase.from("material_catalog").insert(rows);
  if (error) {
    // Pełny błąd do logów; czytelny komunikat dla użytkownika składa
    // humanizeSupabaseError na podstawie kodu w warstwie akcji.
    console.error("bulkCreateCatalogItems insert failed:", error);
    throw error;
  }
  return { inserted: toInsert.length, skipped: items.length - toInsert.length };
}

/**
 * Pełna synchronizacja cennika Mercury (supplier = "Mercury") ze źródłem
 * MERCURY_STARTER. Jedno kliknięcie ogarnia wszystko, bez ręcznej roboty:
 *   • dodaje pozycje, których jeszcze nie ma (po nazwie, case-insensitive),
 *   • aktualizuje cenę/jednostkę/kategorię/notatkę istniejących, gdy się zmieniły,
 *   • USUWA nieaktualne pozycje Mercury, których nie ma już w źródle (np. po zmianie
 *     nazwy/restrukturyzacji), żeby nie zostawały duplikaty/stare ceny.
 * Bezpieczne: job_materials.catalog_id ma ON DELETE SET NULL (istniejące wyceny
 * zachowują swoją kopię nazwy i ceny), a wiązania (auto-wycena/kalkulator) mają
 * ON DELETE CASCADE — usunięcie czyści ewentualne wiązanie bez błędu.
 * UWAGA: kategoria "Mercury" jest w całości zarządzana tym plikiem — własne,
 * ręcznie dodane pozycje oznaczaj innym dostawcą, inaczej sync je usunie.
 */
export async function syncMercuryCatalog(
  items: MaterialCatalogInput[]
): Promise<{ inserted: number; updated: number; deleted: number }> {
  const userId = await uid();
  const supabase = await createClient();

  const { data: existing, error: exErr } = await supabase
    .from("material_catalog")
    .select("id, name, unit, default_price_gross, category, notes")
    .eq("user_id", userId)
    .eq("supplier", "Mercury");
  if (exErr) throw exErr;

  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const byName = new Map<string, Record<string, unknown>>();
  for (const r of existing ?? []) byName.set(norm(r.name), r as Record<string, unknown>);
  const wantedNames = new Set(items.map((it) => norm(it.name)));

  // 1) Dodaj brakujące
  const toInsert = items
    .filter((it) => !byName.has(norm(it.name)))
    .map((it) => ({
      user_id: userId,
      name: it.name,
      unit: it.unit,
      default_price_gross: it.default_price_gross ?? null,
      category: it.category ?? null,
      supplier: "Mercury",
      notes: it.notes ?? null,
    }));
  if (toInsert.length > 0) {
    const { error } = await supabase.from("material_catalog").insert(toInsert);
    if (error) throw error;
  }

  // 2) Zaktualizuj istniejące, gdy coś się zmieniło
  const sameNum = (a: unknown, b: number | null) => {
    const an = a === null || a === undefined ? null : Number(a);
    return an === b;
  };
  let updated = 0;
  for (const it of items) {
    const cur = byName.get(norm(it.name));
    if (!cur) continue;
    const price = it.default_price_gross ?? null;
    const changed =
      !sameNum(cur.default_price_gross, price) ||
      String(cur.unit ?? "") !== it.unit ||
      (cur.category ?? null) !== (it.category ?? null) ||
      (cur.notes ?? null) !== (it.notes ?? null);
    if (!changed) continue;
    const { error } = await supabase
      .from("material_catalog")
      .update({
        unit: it.unit,
        default_price_gross: price,
        category: it.category ?? null,
        notes: it.notes ?? null,
      })
      .eq("id", String(cur.id));
    if (error) throw error;
    updated++;
  }

  // 3) Usuń nieaktualne pozycje Mercury (nie ma ich już w źródle)
  const staleIds = (existing ?? [])
    .filter((r) => !wantedNames.has(norm(r.name)))
    .map((r) => String(r.id));
  let deleted = 0;
  if (staleIds.length > 0) {
    const { error } = await supabase.from("material_catalog").delete().in("id", staleIds);
    if (error) throw error;
    deleted = staleIds.length;
  }

  return { inserted: toInsert.length, updated, deleted };
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
      auto_source: input.auto_source ?? null,
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
