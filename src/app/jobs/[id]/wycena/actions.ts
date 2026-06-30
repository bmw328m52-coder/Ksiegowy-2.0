"use server";

import { revalidatePath } from "next/cache";
import { parseAmount } from "@/lib/format";
import { getBrief, updateBrief } from "@/lib/dao/quote_briefs";
import { reconcileAutoprice, type ReconcileResult } from "@/lib/dao/quote_autoprice";

const QTY_KEY_PREFIX = "__qty_";
const QTY_MAX = 10;

export async function setItemQtyAction(
  briefId: string,
  jobId: string,
  fieldKey: string,
  formData: FormData
) {
  const values: number[] = [];
  for (let i = 0; i < QTY_MAX; i++) {
    const raw = String(formData.get(`qty[${i}]`) ?? "").trim();
    if (!raw) continue;
    const parsed = parseAmount(raw);
    if (parsed === null || parsed < 0) continue;
    values.push(parsed);
  }

  const brief = await getBrief(briefId);
  if (!brief) throw new Error("Brief nie istnieje.");

  const next = { ...brief.data };
  const storeKey = `${QTY_KEY_PREFIX}${fieldKey}`;
  if (values.length === 0) {
    delete next[storeKey];
  } else {
    next[storeKey] = values;
  }

  await updateBrief(briefId, { data: next });

  // Auto-wycena: zsynchronizuj linie z wiązań (best-effort — nie blokuj zapisu ilości).
  try {
    await reconcileAutoprice(jobId);
  } catch {
    // brak wiązań / migracji albo inny błąd reconcile nie może wywrócić zapisu pomiaru
  }

  revalidatePath(`/jobs/${jobId}/wycena`);
}

export async function applyAutopriceAction(
  jobId: string
): Promise<{ error?: string; result?: ReconcileResult }> {
  try {
    const result = await reconcileAutoprice(jobId);
    revalidatePath(`/jobs/${jobId}/wycena`);
    return { result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}
