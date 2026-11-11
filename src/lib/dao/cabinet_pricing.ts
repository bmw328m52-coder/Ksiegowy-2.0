import { createClient } from "@/lib/supabase/server";
import { mergeRates, type Rates, type ScanEstimateChoice } from "@/lib/cabinetPricing";

// Brak tabeli / kolumny = migracja 0052 jeszcze nie wgrana.
const MISSING = ["42P01", "PGRST205", "42703", "PGRST204"];
const MISSING_MSG = "Wgraj migrację 0052_cabinet_pricing.sql w Supabase, żeby zapisywać.";

/** Stawki cennika szafek; bez zapisu (albo bez migracji) — domyślne, skalibrowane na fakturach. */
export async function getCabinetRates(): Promise<{ rates: Rates; saved: boolean; missing: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cabinet_pricing").select("rates").maybeSingle();
  if (error) {
    if (MISSING.includes(error.code)) return { rates: mergeRates(null), saved: false, missing: true };
    throw error;
  }
  return { rates: mergeRates(data?.rates as Partial<Rates> | undefined), saved: !!data, missing: false };
}

export async function saveCabinetRates(rates: Rates): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");
  const { error } = await supabase
    .from("cabinet_pricing")
    .upsert({ user_id: user.id, rates, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(MISSING.includes(error.code) ? MISSING_MSG : error.message);
}

export async function resetCabinetRates(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cabinet_pricing").delete().not("user_id", "is", null);
  if (error && !MISSING.includes(error.code)) throw new Error(error.message);
}

export async function saveScanEstimate(scanId: string, choice: ScanEstimateChoice): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("room_scans").update({ estimate: choice }).eq("id", scanId);
  if (error) throw new Error(MISSING.includes(error.code) ? MISSING_MSG : error.message);
}
