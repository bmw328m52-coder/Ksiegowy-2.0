import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, type UserSettings, type UserSettingsInput } from "./user_settings.types";

export type { UserSettings, UserSettingsInput, VatPeriod } from "./user_settings.types";
export { DEFAULT_SETTINGS } from "./user_settings.types";

export async function getUserSettings(): Promise<UserSettings | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as UserSettings | null;
}

export async function upsertUserSettings(input: UserSettingsInput): Promise<UserSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak sesji.");

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ ...input, user_id: user.id }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data as UserSettings;
}

export async function getUserSettingsOrDefault(): Promise<
  Pick<UserSettings, "tax_form" | "vat_period" | "is_vat_payer" | "default_vat_rate" | "zus_monthly">
> {
  const s = await getUserSettings();
  if (!s) return DEFAULT_SETTINGS;
  return {
    tax_form: s.tax_form,
    vat_period: s.vat_period,
    is_vat_payer: s.is_vat_payer,
    default_vat_rate: Number(s.default_vat_rate),
    zus_monthly: s.zus_monthly == null ? 0 : Number(s.zus_monthly),
  };
}
