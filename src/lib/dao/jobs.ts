import { createClient } from "@/lib/supabase/server";
import type { Job, JobInput } from "./jobs.types";

export type { Job, JobInput, JobStatus } from "./jobs.types";
export { JOB_STATUS_LABELS } from "./jobs.types";

export async function listJobs(): Promise<(Job & { client_name: string })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, clients!inner(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as Job),
    client_name: (row.clients as { name: string }).name,
  }));
}

export async function listJobsByClient(clientId: string): Promise<Job[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Job[];
}

export async function getJob(id: string): Promise<(Job & { client_name: string }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, clients!inner(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...(row as Job),
    client_name: (row.clients as { name: string }).name,
  };
}

export async function createJob(input: JobInput): Promise<Job> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");

  const { data, error } = await supabase
    .from("jobs")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Job;
}

export async function updateJob(id: string, input: JobInput): Promise<Job> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Job;
}

export async function deleteJob(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw error;
}
