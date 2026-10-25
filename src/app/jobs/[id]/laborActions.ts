"use server";

import { revalidatePath } from "next/cache";
import { setFuelAction } from "@/app/materials/actions";

// Paliwo / dojazd ze strony zlecenia — ta sama pozycja co w „Wycenie pozycji”
// (job_materials, group_key „paliwo”), więc obniża zysk szacunkowy zlecenia.
export async function setJobFuelAction(
  jobId: string,
  existingId: string | null,
  amountRaw: string
): Promise<{ error?: string; id?: string | null }> {
  try {
    const row = await setFuelAction(jobId, existingId, amountRaw);
    revalidatePath(`/jobs/${jobId}`);
    return { id: row?.id ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zapisać paliwa." };
  }
}
