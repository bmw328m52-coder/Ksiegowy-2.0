import PageHeader from "@/components/PageHeader";
import { PageContainer } from "@/components/ui";
import SettingsForm, { type SettingsInitial } from "./SettingsForm";
import { saveSettings } from "./actions";
import { getUserSettings, DEFAULT_SETTINGS } from "@/lib/dao/user_settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ustawienia" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const current = await getUserSettings();

  const initial: SettingsInitial = current
    ? {
        business_name: current.business_name,
        business_nip: current.business_nip,
        tax_form: current.tax_form,
        vat_period: current.vat_period,
        is_vat_payer: current.is_vat_payer,
        default_vat_rate: Number(current.default_vat_rate),
        zus_monthly: current.zus_monthly == null ? null : Number(current.zus_monthly),
        default_hourly_rate:
          current.default_hourly_rate == null ? null : Number(current.default_hourly_rate),
      }
    : {
        business_name: "LUVIANO",
        business_nip: null,
        tax_form: DEFAULT_SETTINGS.tax_form,
        vat_period: DEFAULT_SETTINGS.vat_period,
        is_vat_payer: DEFAULT_SETTINGS.is_vat_payer,
        default_vat_rate: DEFAULT_SETTINGS.default_vat_rate,
        zus_monthly: DEFAULT_SETTINGS.zus_monthly,
        default_hourly_rate: DEFAULT_SETTINGS.default_hourly_rate,
      };

  return (
    <PageContainer width="narrow">
      <PageHeader title="Ustawienia" back={{ href: "/wiecej" }} />

      {sp.saved === "1" && (
        <p className="rounded-xl bg-[#e3efe5] border border-[#cfe4d4] text-[#3a6b4d] text-sm px-3.5 py-2.5 font-medium">
          Zapisano ustawienia.
        </p>
      )}

      <SettingsForm action={saveSettings} initial={initial} />
    </PageContainer>
  );
}
