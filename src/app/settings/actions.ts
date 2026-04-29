"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { upsertUserSettings, type UserSettingsInput } from "@/lib/dao/user_settings";
import type { TaxForm } from "@/lib/tax";
import type { VatPeriod } from "@/lib/dao/user_settings.types";

type Result = { error?: string; ok?: boolean };

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function readForm(formData: FormData): UserSettingsInput | string {
  const tax_form = String(formData.get("tax_form") ?? "") as TaxForm;
  if (tax_form !== "skala" && tax_form !== "liniowy") return "Wybierz formę opodatkowania.";

  const vat_period = String(formData.get("vat_period") ?? "") as VatPeriod;
  if (vat_period !== "monthly" && vat_period !== "quarterly") return "Wybierz okres VAT.";

  const is_vat_payer = formData.get("is_vat_payer") === "on";

  const vatPctRaw = String(formData.get("default_vat_rate") ?? "23").trim();
  const vatPct = parseAmount(vatPctRaw);
  if (vatPct === null || vatPct < 0 || vatPct > 100) {
    return "Stawka VAT musi być w zakresie 0–100%.";
  }
  const default_vat_rate = vatPct / 100;

  const zusRaw = String(formData.get("zus_monthly") ?? "").trim();
  const zus_monthly = zusRaw ? parseAmount(zusRaw) : 0;
  if (zus_monthly === null || zus_monthly < 0) return "Nieprawidłowa kwota ZUS.";

  const business_name = String(formData.get("business_name") ?? "").trim() || null;
  const business_nip = String(formData.get("business_nip") ?? "").trim() || null;

  return {
    business_name,
    business_nip,
    tax_form,
    vat_period,
    is_vat_payer,
    default_vat_rate,
    zus_monthly,
    health_insurance_min: null,
  };
}

export async function saveSettings(_prev: Result, formData: FormData): Promise<Result> {
  const parsed = readForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    await upsertUserSettings(parsed);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/calculator");
    redirect("/settings?saved=1");
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}
