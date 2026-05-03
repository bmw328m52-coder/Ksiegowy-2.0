import { createClient } from "@/lib/supabase/server";
import type { QuoteTemplate, QuoteTemplateInput } from "./quote_templates.types";

export type { QuoteTemplate, QuoteTemplateInput } from "./quote_templates.types";

export async function listQuoteTemplates(): Promise<QuoteTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []) as QuoteTemplate[];
}

export async function createQuoteTemplate(input: QuoteTemplateInput): Promise<QuoteTemplate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");
  const { data, error } = await supabase
    .from("quote_templates")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as QuoteTemplate;
}

export async function deleteQuoteTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quote_templates").delete().eq("id", id);
  if (error) throw error;
}
