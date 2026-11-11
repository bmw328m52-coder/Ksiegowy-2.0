"use server";

import { revalidatePath } from "next/cache";
import { mergeRates, type Rates } from "@/lib/cabinetPricing";
import { resetCabinetRates, saveCabinetRates } from "@/lib/dao/cabinet_pricing";

type Result = { error?: string; ok?: boolean };

export async function saveCabinetRatesAction(rates: Rates): Promise<Result> {
  try {
    await saveCabinetRates(mergeRates(rates));
    revalidatePath("/cennik-szafek");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}

export async function resetCabinetRatesAction(): Promise<Result> {
  try {
    await resetCabinetRates();
    revalidatePath("/cennik-szafek");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}
