import type { TaxForm } from "@/lib/tax";

export type VatPeriod = "monthly" | "quarterly";

export type UserSettings = {
  user_id: string;
  business_name: string | null;
  business_nip: string | null;
  tax_form: TaxForm;
  vat_period: VatPeriod;
  zus_monthly: number | null;
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
  health_insurance_min: number | null;
  is_vat_payer: boolean;
  default_vat_rate: number;
};

export const DEFAULT_SETTINGS: Pick<
  UserSettings,
  "tax_form" | "vat_period" | "is_vat_payer" | "default_vat_rate" | "zus_monthly"
> = {
  tax_form: "skala",
  vat_period: "monthly",
  is_vat_payer: true,
  default_vat_rate: 0.23,
  zus_monthly: 0,
};
