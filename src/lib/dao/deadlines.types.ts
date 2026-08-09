export type DeadlineCategory = "zus" | "pit" | "vat" | "jpk" | "ksef" | "inne";

export type Deadline = {
  id: string;
  user_id: string;
  title: string;
  category: DeadlineCategory;
  due_date: string;
  done: boolean;
  note: string | null;
  doc_url: string | null;
  created_at: string;
  updated_at: string;
};

export type DeadlineInput = {
  title: string;
  category: DeadlineCategory;
  due_date: string;
  note?: string | null;
  doc_url?: string | null;
};

export const DEADLINE_CATEGORIES: DeadlineCategory[] = [
  "zus",
  "pit",
  "vat",
  "jpk",
  "ksef",
  "inne",
];

export const DEADLINE_CATEGORY_LABELS: Record<DeadlineCategory, string> = {
  zus: "ZUS",
  pit: "PIT",
  vat: "VAT",
  jpk: "JPK",
  ksef: "KSeF",
  inne: "Inne",
};

export const DEADLINE_CATEGORY_COLORS: Record<DeadlineCategory, string> = {
  zus: "#5a7898",
  pit: "#a06f3f",
  vat: "#b8523a",
  jpk: "#7c3aed",
  ksef: "#15803d",
  inne: "#71717a",
};

export function isDeadlineCategory(v: string): v is DeadlineCategory {
  return (DEADLINE_CATEGORIES as string[]).includes(v);
}
