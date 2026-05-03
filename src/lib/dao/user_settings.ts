import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SETTINGS,
  DEFAULT_MATERIAL_CATEGORIES,
  type UserSettings,
  type UserSettingsInput,
} from "./user_settings.types";

export type { UserSettings, UserSettingsInput, VatPeriod } from "./user_settings.types";
export { DEFAULT_SETTINGS, DEFAULT_MATERIAL_CATEGORIES } from "./user_settings.types";

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

export async function getUserSettingsOrDefault(): Promise<{
  tax_form: UserSettings["tax_form"];
  vat_period: UserSettings["vat_period"];
  is_vat_payer: boolean;
  default_vat_rate: number;
  zus_monthly: number;
  zus_ulga: number;
  zus_maly: number;
  zus_pelny: number;
  material_categories: string[];
}> {
  const s = await getUserSettings();
  if (!s) {
    return {
      tax_form: DEFAULT_SETTINGS.tax_form,
      vat_period: DEFAULT_SETTINGS.vat_period,
      is_vat_payer: DEFAULT_SETTINGS.is_vat_payer,
      default_vat_rate: DEFAULT_SETTINGS.default_vat_rate,
      zus_monthly: 0,
      zus_ulga: DEFAULT_SETTINGS.zus_ulga ?? 0,
      zus_maly: DEFAULT_SETTINGS.zus_maly ?? 0,
      zus_pelny: DEFAULT_SETTINGS.zus_pelny ?? 0,
      material_categories: [...DEFAULT_MATERIAL_CATEGORIES],
    };
  }
  return {
    tax_form: s.tax_form,
    vat_period: s.vat_period,
    is_vat_payer: s.is_vat_payer,
    default_vat_rate: Number(s.default_vat_rate),
    zus_monthly: s.zus_monthly == null ? 0 : Number(s.zus_monthly),
    zus_ulga: s.zus_ulga == null ? 0 : Number(s.zus_ulga),
    zus_maly: s.zus_maly == null ? 0 : Number(s.zus_maly),
    zus_pelny: s.zus_pelny == null ? 0 : Number(s.zus_pelny),
    material_categories:
      s.material_categories && s.material_categories.length > 0
        ? s.material_categories
        : [...DEFAULT_MATERIAL_CATEGORIES],
  };
}
