import { createClient } from "@/lib/supabase/server";
import type { Deadline, DeadlineInput } from "./deadlines.types";

export type { Deadline, DeadlineInput } from "./deadlines.types";
export {
  DEADLINE_CATEGORIES,
  DEADLINE_CATEGORY_LABELS,
  DEADLINE_CATEGORY_COLORS,
  isDeadlineCategory,
} from "./deadlines.types";

export async function listDeadlines(): Promise<Deadline[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deadlines")
    .select("*")
    .order("done", { ascending: true })
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Deadline[];
}

export async function createDeadline(input: DeadlineInput): Promise<Deadline> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");

  const { data, error } = await supabase
    .from("deadlines")
    .insert({
      user_id: user.id,
      title: input.title,
      category: input.category,
      due_date: input.due_date,
      note: input.note ?? null,
      doc_url: input.doc_url ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Deadline;
}

export async function setDeadlineDone(id: string, done: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("deadlines").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function deleteDeadline(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("deadlines").delete().eq("id", id);
  if (error) throw error;
}
