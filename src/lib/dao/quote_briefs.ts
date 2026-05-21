import { createClient } from "@/lib/supabase/server";
import type {
  QuoteBrief,
  QuoteBriefInput,
  QuoteBriefStatus,
  BriefData,
} from "./quote_briefs.types";

export type {
  QuoteBrief,
  QuoteBriefInput,
  QuoteBriefStatus,
  BriefData,
} from "./quote_briefs.types";
export {
  QUOTE_BRIEF_STATUSES,
  QUOTE_BRIEF_STATUS_LABELS,
} from "./quote_briefs.types";

async function uid(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");
  return user.id;
}

export async function listBriefsByClient(clientId: string): Promise<QuoteBrief[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_briefs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function listAllBriefs(): Promise<QuoteBrief[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_briefs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function getBrief(id: string): Promise<QuoteBrief | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_briefs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

export async function getBriefByJob(jobId: string): Promise<QuoteBrief | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_briefs")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

export async function createBrief(input: QuoteBriefInput): Promise<QuoteBrief> {
  const userId = await uid();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_briefs")
    .insert({
      user_id: userId,
      client_id: input.client_id,
      project_type: input.project_type,
      title: input.title,
      visit_date: input.visit_date ?? null,
      status: input.status ?? "draft",
      data: input.data ?? {},
      estimated_amount: input.estimated_amount ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updateBrief(
  id: string,
  patch: Partial<QuoteBriefInput>
): Promise<QuoteBrief> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_briefs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function setBriefStatus(id: string, status: QuoteBriefStatus): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quote_briefs")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function setBriefJob(id: string, jobId: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quote_briefs")
    .update({ job_id: jobId, status: jobId ? "converted" : "draft" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBrief(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quote_briefs").delete().eq("id", id);
  if (error) throw error;
}

function normalize(row: Record<string, unknown>): QuoteBrief {
  return {
    ...(row as QuoteBrief),
    data: (row.data ?? {}) as BriefData,
    estimated_amount:
      row.estimated_amount === null || row.estimated_amount === undefined
        ? null
        : Number(row.estimated_amount),
  };
}
