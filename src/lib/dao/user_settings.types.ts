import type { TaxForm } from "@/lib/tax";

export type VatPeriod = "monthly" | "quarterly";

export const DEFAULT_MATERIAL_CATEGORIES = [
  "fronty",
  "blaty",
  "szuflady",
  "zawiasy",
  "siłowniki",
  "ledy",
  "zawieszki",
  "nóżki",
  "szyna zawieszkowa",
  "projekt",
  "silikony",
  "klej",
  "złącza",
  "kosze cargo",
  "systemy",
  "wkład do szuflady",
] as const;

export type UserSettings = {
  user_id: string;
  business_name: string | null;
  business_nip: string | null;
  tax_form: TaxForm;
  vat_period: VatPeriod;
  zus_monthly: number | null;
  zus_ulga: number | null;
  zus_maly: number | null;
  zus_pelny: number | null;
  material_categories: string[] | null;
  health_insurance_min: number | null;
  is_vat_payer: boolean;
  default_vat_rate: number;
  created_at: string;
  updated_at: string;
};

export type UserSettingsInput = {
  business_name: string | null;
  business_nip: string | null;
  tax_form: TaxForm;
  vat_period: VatPeriod;
  zus_monthly: number | null;
  zus_ulga: number | null;
  zus_maly: number | null;
  zus_pelny: number | null;
  material_categories: string[];
  health_insurance_min: number | null;
  is_vat_payer: boolean;
  default_vat_rate: number;
};

export const DEFAULT_SETTINGS: Pick<
  UserSettings,
  | "tax_form"
  | "vat_period"
  | "is_vat_payer"
  | "default_vat_rate"
  | "zus_monthly"
  | "zus_ulga"
  | "zus_maly"
  | "zus_pelny"
> & { material_categories: string[] } = {
  tax_form: "skala",
  vat_period: "monthly",
  is_vat_payer: true,
  default_vat_rate: 0.23,
  zus_monthly: 0,
  zus_ulga: 397.16,
  zus_maly: 891.34,
  zus_pelny: 1900.0,
  material_categories: [...DEFAULT_MATERIAL_CATEGORIES],
};
