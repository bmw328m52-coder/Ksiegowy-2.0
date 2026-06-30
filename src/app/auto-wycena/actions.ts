"use server";

import { revalidatePath } from "next/cache";
import {
  upsertAutopriceBinding,
  deleteAutopriceBinding,
} from "@/lib/dao/quote_autoprice";

type Result = { error?: string; ok?: boolean };

export async function saveAutopriceBindingAction(
  slot: string,
  catalogId: string
): Promise<Result> {
  try {
    if (catalogId) {
      await upsertAutopriceBinding(slot, catalogId);
    } else {
      await deleteAutopriceBinding(slot);
    }
    revalidatePath("/auto-wycena");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}
