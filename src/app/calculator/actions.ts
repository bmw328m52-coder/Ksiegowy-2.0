"use server";

import { revalidatePath } from "next/cache";
import {
  createQuoteTemplate,
  deleteQuoteTemplate as daoDelete,
} from "@/lib/dao/quote_templates";
import type { TaxForm } from "@/lib/tax";

type Result = { error?: string };

export async function saveQuoteTemplateAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Podaj nazwę szablonu." };

  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    if (v === "") return 0;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const taxFormVal = String(formData.get("tax_form") ?? "skala");
  const taxForm: TaxForm = taxFormVal === "liniowy" ? "liniowy" : "skala";

  try {
    await createQuoteTemplate({
      name,
      amount_gross: num("amount_gross"),
      vat_rate: num("vat_rate"),
      costs_gross: num("costs_gross"),
      costs_vat_rate: num("costs_vat_rate"),
      tax_form: taxForm,
      is_vat_payer: String(formData.get("is_vat_payer")) === "true",
      notes: null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zapisać szablonu." };
  }

  revalidatePath("/calculator");
  return {};
}

export async function deleteQuoteTemplateAction(id: string): Promise<void> {
  await daoDelete(id);
  revalidatePath("/calculator");
}
