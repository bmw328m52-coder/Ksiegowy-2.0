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
  "materiały",
  "usługi",
  "transport",
  "narzędzia",
  "biuro",
  "paliwo",
  "inne",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];
