import { createClient } from "@/lib/supabase/server";
import type { KitchenProject, KitchenQuoteSnapshot } from "@/lib/kitchen/types";
import { KITCHEN_GROUPS, KITCHEN_SOURCE_PREFIX, type MaterialLine } from "@/lib/kitchen/materials";

// Brak tabeli = migracja 0054 jeszcze nie wgrana.
const MISSING = ["42P01", "PGRST205"];
export const KITCHEN_MISSING_MSG = "Wgraj migrację 0054_kitchen_projects.sql w Supabase, żeby zapisywać projekt kuchni.";

export type KitchenProjectRow = {
  id: string;
  job_id: string;
  scan_id: string | null;
  name: string;
  data: KitchenProject;
  quote: KitchenQuoteSnapshot | null;
  updated_at: string;
};

/** Najnowszy projekt kuchni przypisany do zlecenia (null, gdy brak lub brak migracji). */
export async function getKitchenProject(jobId: string): Promise<KitchenProjectRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_projects")
    .select("id,job_id,scan_id,name,data,quote,updated_at")
    .eq("job_id", jobId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (MISSING.includes(error.code)) return null;
    throw error;
  }
  return (data as KitchenProjectRow | null) ?? null;
}

export async function saveKitchenProject(input: {
  id?: string | null;
  jobId: string;
  scanId: string | null;
  data: KitchenProject;
  quote: KitchenQuoteSnapshot;
}): Promise<string> {
  const supabase = await createClient();
  const row = { scan_id: input.scanId, data: input.data, quote: input.quote, updated_at: new Date().toISOString() };
  if (input.id) {
    const { error } = await supabase.from("kitchen_projects").update(row).eq("id", input.id);
    if (error) throw new Error(MISSING.includes(error.code) ? KITCHEN_MISSING_MSG : error.message);
    return input.id;
  }
  const { data, error } = await supabase.from("kitchen_projects").insert({ ...row, job_id: input.jobId }).select("id").single();
  if (error) throw new Error(MISSING.includes(error.code) ? KITCHEN_MISSING_MSG : error.message);
  return data.id as string;
}

export type KitchenMaterialsResult = { created: number; updated: number; removed: number; duplicates: number };

/**
 * Wiązanie z wyceną: linie job_materials z auto_source "kuchnia:*" odpowiadają projektowi 1:1.
 * Nowe → insert, istniejące → update (ilość i cena nadpisywane), nieaktualne → delete.
 * duplicates = inne (ręczne / auto z pomiaru) pozycje w tych samych grupach — ryzyko podwójnego liczenia.
 */
export async function reconcileKitchenMaterials(jobId: string, lines: MaterialLine[]): Promise<KitchenMaterialsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");

  const { data: rows, error } = await supabase.from("job_materials").select("id,auto_source,group_key").eq("job_id", jobId);
  if (error) {
    if (error.code === "42703") throw new Error("Wgraj migrację 0026 (kolumna auto_source w job_materials).");
    throw new Error(error.message);
  }
  const mine = new Map<string, string>();
  let duplicates = 0;
  for (const r of (rows ?? []) as { id: string; auto_source: string | null; group_key: string | null }[]) {
    if (r.auto_source?.startsWith(KITCHEN_SOURCE_PREFIX)) mine.set(r.auto_source, r.id);
    else if (r.group_key && KITCHEN_GROUPS.includes(r.group_key)) duplicates++;
  }

  let created = 0;
  let updated = 0;
  for (const l of lines) {
    const id = mine.get(l.auto_source);
    const body = { group_key: l.group_key, name: l.name, unit: l.unit, qty: l.qty, unit_price_gross: l.unit_price_gross };
    if (id) {
      const { error: e } = await supabase.from("job_materials").update(body).eq("id", id);
      if (e) throw new Error(e.message);
      updated++;
    } else {
      const { error: e } = await supabase
        .from("job_materials")
        .insert({ ...body, user_id: user.id, job_id: jobId, catalog_id: null, notes: "Auto z projektu kuchni", auto_source: l.auto_source });
      if (e) throw new Error(e.message);
      created++;
    }
  }
  const keep = new Set(lines.map((l) => l.auto_source));
  const stale = [...mine.entries()].filter(([k]) => !keep.has(k)).map(([, id]) => id);
  if (stale.length > 0) {
    const { error: e } = await supabase.from("job_materials").delete().in("id", stale);
    if (e) throw new Error(e.message);
  }
  return { created, updated, removed: stale.length, duplicates };
}
