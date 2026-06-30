import { createClient } from "@/lib/supabase/server";
import { getBriefByJob } from "./quote_briefs";

// ── Definicja slotów auto-wyceny ─────────────────────────────────────────────
// Każdy slot mapuje pozycję z pomiaru (ilość lub rozpiskę) na pozycję cennika,
// a wynik trafia do grupy wyceny (group_key) jako linia z auto_source = slot.key.

export type AutopriceSource =
  | { kind: "qty"; fieldKey: string; groupKey: string }
  | { kind: "field_num"; fieldKey: string; groupKey: string }
  | { kind: "hinge"; type: string; groupKey: string }
  | { kind: "lift"; match: string; groupKey: string };

export type AutopriceSlot = {
  key: string;
  label: string;
  section: string;
  preferredCategories: string[];
  source: AutopriceSource;
};

export const AUTOPRICE_SLOTS: AutopriceSlot[] = [
  // — Fronty / blat —
  { key: "lakier_m2", label: "Lakier MDF (m²)", section: "Fronty i blat",
    preferredCategories: ["Fronty lakierowane MDF (JUKA)"],
    source: { kind: "qty", fieldKey: "front_material", groupKey: "fronty_lakier" } },
  { key: "otwieranie", label: "Otwieranie / uchwyty (szt)", section: "Fronty i blat",
    preferredCategories: ["Uchwyty", "Tip-on"],
    source: { kind: "qty", fieldKey: "front_opening", groupKey: "fronty_uchwyty" } },
  { key: "blat_mb", label: "Blat (mb)", section: "Fronty i blat",
    preferredCategories: ["Blaty"],
    source: { kind: "qty", fieldKey: "worktop_material", groupKey: "blat" } },

  // — Szuflady (ilość z pola drawer_count × wybrany zestaw) —
  { key: "szuflady", label: "Szuflady — zestaw (szt)", section: "Szuflady",
    preferredCategories: ["Szuflady"],
    source: { kind: "field_num", fieldKey: "drawer_count", groupKey: "okucia_szuflady" } },

  // — Oświetlenie LED —
  { key: "led_pod_mb", label: "LED pod szafkami (mb)", section: "Oświetlenie",
    preferredCategories: ["Oświetlenie LED", "LED"],
    source: { kind: "qty", fieldKey: "led_under_upper", groupKey: "oswietlenie_led" } },
  { key: "led_szafki_mb", label: "LED w szafkach (mb)", section: "Oświetlenie",
    preferredCategories: ["Oświetlenie LED", "LED"],
    source: { kind: "qty", fieldKey: "led_inside_upper", groupKey: "oswietlenie_led" } },
  { key: "led_cokol_mb", label: "LED w cokole (mb)", section: "Oświetlenie",
    preferredCategories: ["Oświetlenie LED", "LED"],
    source: { kind: "qty", fieldKey: "led_plinth", groupKey: "oswietlenie_led" } },

  // — Zawiasy (rozpiska, 6 stałych typów) —
  { key: "hinge_110_z", label: "Zawias 110° z hamulcem", section: "Zawiasy",
    preferredCategories: ["Zawiasy"], source: { kind: "hinge", type: "110_z", groupKey: "okucia_zawiasy" } },
  { key: "hinge_110_bez", label: "Zawias 110° bez hamulca", section: "Zawiasy",
    preferredCategories: ["Zawiasy"], source: { kind: "hinge", type: "110_bez", groupKey: "okucia_zawiasy" } },
  { key: "hinge_155_z", label: "Zawias 155° z hamulcem", section: "Zawiasy",
    preferredCategories: ["Zawiasy"], source: { kind: "hinge", type: "155_z", groupKey: "okucia_zawiasy" } },
  { key: "hinge_155_bez", label: "Zawias 155° bez hamulca", section: "Zawiasy",
    preferredCategories: ["Zawiasy"], source: { kind: "hinge", type: "155_bez", groupKey: "okucia_zawiasy" } },
  { key: "hinge_rownolegle_z", label: "Zawias równoległy z hamulcem", section: "Zawiasy",
    preferredCategories: ["Zawiasy"], source: { kind: "hinge", type: "rownolegle_z", groupKey: "okucia_zawiasy" } },
  { key: "hinge_rownolegle_bez", label: "Zawias równoległy bez hamulca", section: "Zawiasy",
    preferredCategories: ["Zawiasy"], source: { kind: "hinge", type: "rownolegle_bez", groupKey: "okucia_zawiasy" } },

  // — Siłowniki Aventos (rozpiska to wolny tekst — dopasowanie po HF/HK/HL/HS) —
  { key: "lift_hf", label: "Aventos HF", section: "Siłowniki",
    preferredCategories: ["Aventos"], source: { kind: "lift", match: "hf", groupKey: "okucia_silowniki" } },
  { key: "lift_hk", label: "Aventos HK", section: "Siłowniki",
    preferredCategories: ["Aventos"], source: { kind: "lift", match: "hk", groupKey: "okucia_silowniki" } },
  { key: "lift_hl", label: "Aventos HL", section: "Siłowniki",
    preferredCategories: ["Aventos"], source: { kind: "lift", match: "hl", groupKey: "okucia_silowniki" } },
  { key: "lift_hs", label: "Aventos HS", section: "Siłowniki",
    preferredCategories: ["Aventos"], source: { kind: "lift", match: "hs", groupKey: "okucia_silowniki" } },
];

export type Binding = { slot: string; catalog_id: string };

// ── DAO wiązań ───────────────────────────────────────────────────────────────

export async function listAutopriceBindings(): Promise<Binding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_autoprice_bindings")
    .select("slot, catalog_id");
  if (error) {
    // Tabela jeszcze nie wgrana (migracja 0026) — nie wywracaj appki.
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []) as Binding[];
}

export async function upsertAutopriceBinding(slot: string, catalogId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");
  const { error } = await supabase
    .from("quote_autoprice_bindings")
    .upsert({ user_id: user.id, slot, catalog_id: catalogId }, { onConflict: "user_id,slot" });
  if (error) throw new Error(error.message);
}

export async function deleteAutopriceBinding(slot: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quote_autoprice_bindings").delete().eq("slot", slot);
  if (error) throw new Error(error.message);
}

// ── Reconcile: z pomiaru + wiązań → linie job_materials (auto_source) ─────────

type DesiredLine = {
  auto_source: string;
  group_key: string;
  catalog_id: string;
  name: string;
  unit: string;
  qty: number;
  unit_price_gross: number | null;
};

function sumQty(data: Record<string, unknown>, fieldKey: string): number {
  const v = data[`__qty_${fieldKey}`];
  if (!Array.isArray(v)) return 0;
  return v.reduce((acc: number, x) => {
    const n = typeof x === "number" ? x : Number(x);
    return Number.isFinite(n) ? acc + n : acc;
  }, 0);
}

function parseBreakdown(value: unknown): { type: string; count: number }[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((e) => {
        const o = (e ?? {}) as Record<string, unknown>;
        const type = typeof o.type === "string" ? o.type : "";
        const raw = o.count;
        const count = typeof raw === "number" ? raw : Number(raw);
        return { type, count: Number.isFinite(count) ? count : 0 };
      })
      .filter((e) => e.type && e.count > 0);
  } catch {
    return [];
  }
}

export type ReconcileResult = { created: number; updated: number; removed: number };

export async function reconcileAutoprice(jobId: string): Promise<ReconcileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");

  const [brief, bindings] = await Promise.all([
    getBriefByJob(jobId),
    listAutopriceBindings(),
  ]);

  const bindingBySlot = new Map(bindings.map((b) => [b.slot, b.catalog_id]));
  const data = (brief?.data ?? {}) as Record<string, unknown>;

  // Cennik (tylko związane pozycje) — nazwa, jednostka, cena.
  const catalogIds = Array.from(new Set(bindings.map((b) => b.catalog_id)));
  const catalogById = new Map<
    string,
    { name: string; unit: string; price: number | null }
  >();
  if (catalogIds.length > 0) {
    const { data: cat, error } = await supabase
      .from("material_catalog")
      .select("id, name, unit, default_price_gross")
      .in("id", catalogIds);
    if (error) throw new Error(error.message);
    for (const c of cat ?? []) {
      const row = c as Record<string, unknown>;
      catalogById.set(String(row.id), {
        name: String(row.name),
        unit: String(row.unit ?? "szt"),
        price:
          row.default_price_gross === null || row.default_price_gross === undefined
            ? null
            : Number(row.default_price_gross),
      });
    }
  }

  const hinges = parseBreakdown(data.hinges_breakdown);
  const lifts = parseBreakdown(data.lift_breakdown);

  const desired: DesiredLine[] = [];
  for (const slot of AUTOPRICE_SLOTS) {
    const catalogId = bindingBySlot.get(slot.key);
    if (!catalogId) continue;
    const cat = catalogById.get(catalogId);
    if (!cat) continue;

    let qty = 0;
    if (slot.source.kind === "qty") {
      qty = sumQty(data, slot.source.fieldKey);
    } else if (slot.source.kind === "field_num") {
      const raw = data[slot.source.fieldKey];
      const n = typeof raw === "number" ? raw : Number(raw);
      qty = Number.isFinite(n) ? n : 0;
    } else if (slot.source.kind === "hinge") {
      qty = hinges
        .filter((h) => h.type === (slot.source as { type: string }).type)
        .reduce((a, h) => a + h.count, 0);
    } else {
      const m = (slot.source as { match: string }).match;
      qty = lifts
        .filter((l) => l.type.toLowerCase().includes(m))
        .reduce((a, l) => a + l.count, 0);
    }
    if (qty <= 0) continue;

    desired.push({
      auto_source: slot.key,
      group_key: slot.source.groupKey,
      catalog_id: catalogId,
      name: cat.name,
      unit: cat.unit,
      qty,
      unit_price_gross: cat.price,
    });
  }

  // Istniejące linie auto dla tego zlecenia.
  const { data: existingRows, error: exErr } = await supabase
    .from("job_materials")
    .select("id, auto_source")
    .eq("job_id", jobId)
    .not("auto_source", "is", null);
  if (exErr) {
    if (exErr.code === "42703") return { created: 0, updated: 0, removed: 0 };
    throw new Error(exErr.message);
  }
  const existingBySource = new Map<string, string>();
  for (const r of existingRows ?? []) {
    const row = r as { id: string; auto_source: string };
    existingBySource.set(row.auto_source, row.id);
  }

  const desiredSources = new Set(desired.map((d) => d.auto_source));
  let created = 0;
  let updated = 0;
  let removed = 0;

  // Insert / update.
  for (const d of desired) {
    const existingId = existingBySource.get(d.auto_source);
    if (existingId) {
      const { error } = await supabase
        .from("job_materials")
        .update({
          group_key: d.group_key,
          catalog_id: d.catalog_id,
          name: d.name,
          unit: d.unit,
          qty: d.qty,
          unit_price_gross: d.unit_price_gross,
        })
        .eq("id", existingId);
      if (error) throw new Error(error.message);
      updated++;
    } else {
      const { error } = await supabase.from("job_materials").insert({
        user_id: user.id,
        job_id: jobId,
        catalog_id: d.catalog_id,
        group_key: d.group_key,
        name: d.name,
        unit: d.unit,
        qty: d.qty,
        unit_price_gross: d.unit_price_gross,
        notes: "Auto z pomiaru",
        auto_source: d.auto_source,
      });
      if (error) throw new Error(error.message);
      created++;
    }
  }

  // Usuń linie auto, których już nie ma w pomiarze.
  const toRemove = Array.from(existingBySource.entries())
    .filter(([source]) => !desiredSources.has(source))
    .map(([, id]) => id);
  if (toRemove.length > 0) {
    const { error } = await supabase.from("job_materials").delete().in("id", toRemove);
    if (error) throw new Error(error.message);
    removed = toRemove.length;
  }

  return { created, updated, removed };
}
