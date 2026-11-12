"use server";

import { revalidatePath } from "next/cache";
import {
  createQuoteTemplate,
  deleteQuoteTemplate as daoDelete,
} from "@/lib/dao/quote_templates";
import type { TaxForm } from "@/lib/tax";
import { createClientRow, getClient } from "@/lib/dao/clients";
import { createJob } from "@/lib/dao/jobs";

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

// Nowe zlecenie prosto z kalkulatora (opcjonalnie razem z nowym klientem), żeby wycenę
// było do czego przypiąć. Kwota = 0 — ustawia ją dopiero „Przenieś wycenę do zlecenia".
export async function createJobForQuoteAction(input: {
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  title: string;
  vatRate: number;
}): Promise<{ error?: string; job?: { id: string; title: string; client_name: string } }> {
  const title = input.title.trim();
  if (!title) return { error: "Podaj nazwę zlecenia." };
  const vatRate = Number.isFinite(input.vatRate) && input.vatRate >= 0 && input.vatRate <= 1 ? input.vatRate : 0;

  try {
    let client: { id: string; name: string } | null = null;
    if (input.clientId) {
      client = await getClient(input.clientId);
      if (!client) return { error: "Klient nie istnieje." };
    } else {
      const name = (input.clientName ?? "").trim();
      if (!name) return { error: "Podaj nazwę klienta." };
      client = await createClientRow({
        type: "individual",
        name,
        phone: (input.clientPhone ?? "").trim() || null,
      });
    }
    const job = await createJob({
      client_id: client.id,
      title,
      amount_gross: 0,
      vat_rate: vatRate,
      status: "to_quote",
    });
    revalidatePath("/jobs");
    revalidatePath("/clients");
    revalidatePath(`/clients/${client.id}`);
    revalidatePath("/calculator");
    return { job: { id: job.id, title: job.title, client_name: client.name } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}
