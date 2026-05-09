"use server";

import { revalidatePath } from "next/cache";
import { getActiveTimer, stopTimer } from "@/lib/dao/time_entries";

export async function stopAnyActiveTimerAction(): Promise<{ error?: string }> {
  try {
    const active = await getActiveTimer();
    if (!active) return {};
    await stopTimer(active.id);
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zatrzymać licznika." };
  }
}
