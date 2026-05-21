import { createClient } from "@/lib/supabase/server";
import type { ManualEntryInput, TimeEntry, WorkPhase } from "./time_entries.types";

export type { ManualEntryInput, TimeEntry, WorkPhase } from "./time_entries.types";
export { WORK_PHASES, WORK_PHASE_LABELS } from "./time_entries.types";

async function uid(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");
  return user.id;
}

export async function getActiveTimer(): Promise<TimeEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .is("ended_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as TimeEntry | null;
}

export async function startTimer(jobId: string, phase: WorkPhase): Promise<TimeEntry> {
  const userId = await uid();
  const supabase = await createClient();

  const active = await getActiveTimer();
  if (active) {
    await stopTimer(active.id);
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      user_id: userId,
      job_id: jobId,
      phase,
      source: "timer",
    })
    .select()
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

export async function stopTimer(entryId: string): Promise<TimeEntry> {
  const supabase = await createClient();
  const { data: entry, error: getErr } = await supabase
    .from("time_entries")
    .select("*")
    .eq("id", entryId)
    .single();
  if (getErr) throw getErr;
  const e = entry as TimeEntry;

  const startedMs = new Date(e.started_at).getTime();
  const endedMs = Date.now();
  const minutes = Math.max(0, Math.round((endedMs - startedMs) / 60000));

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      ended_at: new Date(endedMs).toISOString(),
      duration_minutes: minutes,
    })
    .eq("id", entryId)
    .select()
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

export async function listEntriesByJob(jobId: string): Promise<TimeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("job_id", jobId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

export async function listRecentEntries(limit = 20): Promise<TimeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

export async function addManualEntry(input: ManualEntryInput): Promise<TimeEntry> {
  const userId = await uid();
  const supabase = await createClient();

  const startedAt = `${input.date}T08:00:00.000Z`;
  const startedMs = new Date(startedAt).getTime();
  const endedMs = startedMs + input.duration_minutes * 60_000;

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      user_id: userId,
      job_id: input.job_id,
      phase: input.phase,
      started_at: startedAt,
      ended_at: new Date(endedMs).toISOString(),
      duration_minutes: input.duration_minutes,
      source: "manual",
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

export async function deleteEntry(entryId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
  if (error) throw error;
}

export type UpdateEntryInput = {
  phase?: WorkPhase;
  duration_minutes?: number;
  notes?: string | null;
};

export async function updateEntry(
  entryId: string,
  patch: UpdateEntryInput
): Promise<TimeEntry> {
  const supabase = await createClient();

  const { data: existing, error: getErr } = await supabase
    .from("time_entries")
    .select("*")
    .eq("id", entryId)
    .single();
  if (getErr) throw getErr;
  const cur = existing as TimeEntry;

  const update: Record<string, unknown> = {};
  if (patch.phase) update.phase = patch.phase;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.duration_minutes !== undefined) {
    const minutes = Math.max(0, Math.round(patch.duration_minutes));
    update.duration_minutes = minutes;
    const startedMs = new Date(cur.started_at).getTime();
    update.ended_at = new Date(startedMs + minutes * 60_000).toISOString();
  }

  const { data, error } = await supabase
    .from("time_entries")
    .update(update)
    .eq("id", entryId)
    .select()
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

export type PhaseSums = Record<WorkPhase, number>;

export function emptyPhaseSums(): PhaseSums {
  return { pomiar: 0, projekt: 0, produkcja: 0, montaz: 0, inne: 0 };
}

export function sumByPhase(entries: TimeEntry[]): PhaseSums {
  const out = emptyPhaseSums();
  for (const e of entries) {
    if (e.duration_minutes != null) out[e.phase] += e.duration_minutes;
  }
  return out;
}

export function totalMinutes(entries: TimeEntry[]): number {
  let sum = 0;
  for (const e of entries) {
    if (e.duration_minutes != null) sum += e.duration_minutes;
  }
  return sum;
}

export async function getJobMeta(jobId: string): Promise<{ id: string; title: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as { id: string; title: string } | null;
}
