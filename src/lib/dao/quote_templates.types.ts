import type { TaxForm } from "@/lib/tax";

export type QuoteTemplate = {
  id: string;
  user_id: string;
  name: string;
  amount_gross: string;
  vat_rate: string;
  costs_gross: string;
  costs_vat_rate: string;
  tax_form: TaxForm;
  is_vat_payer: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteTemplateInput = {
  name: string;
  amount_gross: number;
  vat_rate: number;
  costs_gross: number;
  costs_vat_rate: number;
  tax_form: TaxForm;
  is_vat_payer: boolean;
  notes?: string | null;
};
