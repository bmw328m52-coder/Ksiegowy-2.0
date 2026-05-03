export type CostLine = {
  id: string;
  user_id: string;
  invoice_id: string | null;
  job_id: string | null;
  description: string;
  amount_net: string;
  amount_vat: string;
  amount_gross: string;
  vat_rate: string | null;
  category: string | null;
  cost_date: string;
  created_at: string;
  updated_at: string;
};

export type CostLineInput = {
  invoice_id?: string | null;
  job_id?: string | null;
  description: string;
  amount_net: number;
  amount_vat: number;
  amount_gross: number;
  vat_rate?: number | null;
  category?: string | null;
  cost_date: string;
};

export const COST_CATEGORIES = [
  "płyty/drewno",
  "okucia",
  "materiały",
  "narzędzia",
  "usługi",
  "transport",
  "paliwo",
  "biuro",
  "inne",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export const CATEGORY_COLORS: Record<string, string> = {
  "płyty/drewno": "#a16207",
  okucia: "#0369a1",
  materiały: "#7c3aed",
  narzędzia: "#475569",
  usługi: "#15803d",
  transport: "#c2410c",
  paliwo: "#b91c1c",
  biuro: "#9d174d",
  inne: "#71717a",
};
