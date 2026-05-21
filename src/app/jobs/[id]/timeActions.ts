"use server";

import { revalidatePath } from "next/cache";
import {
  addManualEntry,
  deleteEntry,
  getActiveTimer,
  startTimer,
  stopTimer,
  updateEntry,
} from "@/lib/dao/time_entries";
import type { WorkPhase } from "@/lib/dao/time_entries";

type Result = { error?: string };

const PHASES: WorkPhase[] = ["pomiar", "projekt", "produkcja", "montaz", "inne"];

function refresh(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/timer");
  revalidatePath("/", "layout");
}

export async function startTimerAction(jobId: string, phase: WorkPhase): Promise<Result> {
  if (!PHASES.includes(phase)) return { error: "Nieznana faza." };
  try {
    await startTimer(jobId, phase);
    refresh(jobId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się włączyć licznika." };
  }
}

export async function stopActiveTimerAction(jobId: string): Promise<Result> {
  try {
    const active = await getActiveTimer();
    if (!active) return {};
    await stopTimer(active.id);
    refresh(jobId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zatrzymać licznika." };
  }
}

export async function addManualEntryAction(
  jobId: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const phase = String(formData.get("phase") ?? "") as WorkPhase;
  if (!PHASES.includes(phase)) return { error: "Wybierz fazę." };

  const date = String(formData.get("date") ?? "").trim();
  if (!date) return { error: "Podaj datę." };

  const hoursRaw = String(formData.get("hours") ?? "").trim().replace(",", ".");
  const minutesRaw = String(formData.get("minutes") ?? "").trim();
  const hours = hoursRaw === "" ? 0 : Number(hoursRaw);
  const minutes = minutesRaw === "" ? 0 : Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0) {
    return { error: "Nieprawidłowy czas." };
  }
  const total = Math.round(hours * 60 + minutes);
  if (total <= 0) return { error: "Czas musi być większy od 0." };

  const notes = String(formData.get("notes") ?? "").trim() || null;

  try {
    await addManualEntry({
      job_id: jobId,
      phase,
      date,
      duration_minutes: total,
      notes,
    });
    refresh(jobId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się dodać wpisu." };
  }
}

export async function deleteEntryAction(jobId: string, entryId: string): Promise<Result> {
  try {
    await deleteEntry(entryId);
    refresh(jobId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się usunąć wpisu." };
  }
}

export async function updateEntryAction(
  jobId: string,
  entryId: string,
  input: { phase: WorkPhase; hours: number; minutes: number; notes: string | null }
): Promise<Result> {
  if (!PHASES.includes(input.phase)) return { error: "Wybierz fazę." };
  if (
    !Number.isFinite(input.hours) ||
    !Number.isFinite(input.minutes) ||
    input.hours < 0 ||
    input.minutes < 0
  ) {
    return { error: "Nieprawidłowy czas." };
  }
  const total = Math.round(input.hours * 60 + input.minutes);
  if (total <= 0) return { error: "Czas musi być większy od 0." };

  try {
    await updateEntry(entryId, {
      phase: input.phase,
      duration_minutes: total,
      notes: input.notes,
    });
    refresh(jobId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zapisać zmian." };
  }
}
