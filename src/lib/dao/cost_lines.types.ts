export type CostLine = {
  id: string;
  user_id: string;
  invoice_id: string | null;
  job_id: string | null;
  catalog_id: string | null;
  description: string;
  amount_net: string;
  amount_vat: string;
  amount_gross: string;
  qty: string;
  vat_rate: string | null;
  category: string | null;
  cost_date: string;
  vat_deduction: number;
  created_at: string;
  updated_at: string;
};

// Odliczenie VAT (%). Auto-podpowiedź 50% dla paliwa/samochodu.
export type VatDeduction = 0 | 50 | 100;

export const VAT_DEDUCTION_VALUES: VatDeduction[] = [100, 50, 0];

export const VAT_DEDUCTION_LABELS: Record<VatDeduction, string> = {
  100: "100%",
  50: "50%",
  0: "Nie odliczam",
};

// Kategorie kosztów samochodowych → domyślnie 50% VAT do odliczenia.
export function suggestedVatDeduction(category: string | null | undefined): VatDeduction {
  return category === "paliwo" ? 50 : 100;
}

export type CostLineInput = {
  invoice_id?: string | null;
  job_id?: string | null;
  catalog_id?: string | null;
  description: string;
  amount_net: number;
  amount_vat: number;
  amount_gross: number;
  qty?: number;
  vat_rate?: number | null;
  category?: string | null;
  cost_date: string;
  vat_deduction?: number;
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
