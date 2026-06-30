import { createClient } from "@/lib/supabase/server";
import { PRICES } from "@/app/calculator/moduly/catalog";

export type SlotKey =
  | "hdf_m2"
  | "okleina_2mm_mb"
  | "okleina_04mm_mb"
  | "zawias_szt"
  | "prowadnica_komplet"
  | "noga_szt";

export type SlotDef = {
  key: SlotKey;
  label: string;
  unit: string;
  /** Sugerowane kategorie katalogu — UI filtruje dropdown po nich. */
  preferredCategories: string[];
};

export const SLOTS: SlotDef[] = [
  {
    key: "hdf_m2",
    label: "HDF 3mm (plecy szafek)",
    unit: "m2",
    preferredCategories: ["HDF (plecy)"],
  },
  {
    key: "okleina_2mm_mb",
    label: "Okleina ABS 2mm (krawędzie widoczne)",
    unit: "mb",
    preferredCategories: ["Obrzeża ABS 42×2"],
  },
  {
    key: "okleina_04mm_mb",
    label: "Okleina ABS 0.8mm (krawędzie niewidoczne)",
    unit: "mb",
    preferredCategories: ["Obrzeża ABS 22×0.8"],
  },
  {
    key: "zawias_szt",
    label: "Zawias (szt)",
    unit: "szt",
    preferredCategories: ["Zawiasy"],
  },
  {
    key: "prowadnica_komplet",
    label: "Prowadnica szuflady (komplet)",
    unit: "kpl",
    preferredCategories: ["Szuflady — części"],
  },
  {
    key: "noga_szt",
    label: "Noga regulowana (szt)",
    unit: "szt",
    preferredCategories: ["Nogi i cokoły"],
  },
];

export type Binding = {
  slot: SlotKey;
  catalog_id: string;
};

export const VAT_DEFAULT = 1.23;
/** Brutto → netto (kalkulator pracuje w netto). */
export const grossToNet = (gross: number) => gross / VAT_DEFAULT;

export async function listBindings(): Promise<Binding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calculator_bindings")
    .select("slot, catalog_id");
  if (error) throw error;
  return (data ?? []) as Binding[];
}

export async function upsertBinding(slot: SlotKey, catalogId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");
  const { error } = await supabase
    .from("calculator_bindings")
    .upsert({ user_id: user.id, slot, catalog_id: catalogId }, { onConflict: "user_id,slot" });
  if (error) throw error;
}

export async function deleteBinding(slot: SlotKey): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("calculator_bindings")
    .delete()
    .eq("slot", slot);
  if (error) throw error;
}

export type PricesOverride = typeof PRICES;

/**
 * Buduje efektywny słownik PRICES — bindings zastępują hardcoded wartości.
 * Brutto z katalogu / 1.23 → netto (kalkulator pracuje w netto).
 */
export function resolvePrices(
  bindings: Binding[],
  catalogPriceById: Map<string, number | null>,
): PricesOverride {
  const out: PricesOverride = { ...PRICES };
  for (const b of bindings) {
    const gross = catalogPriceById.get(b.catalog_id);
    if (gross === null || gross === undefined) continue;
    out[b.slot] = grossToNet(gross);
  }
  return out;
}
