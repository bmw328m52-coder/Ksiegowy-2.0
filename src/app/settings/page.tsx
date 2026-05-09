import PageHeader from "@/components/PageHeader";
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
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-4">
        <PageHeader title="Ustawienia" back={{ href: "/" }} />

        {sp.saved === "1" && (
          <p className="rounded-md bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2">
            Zapisano ustawienia.
          </p>
        )}

        <SettingsForm action={saveSettings} initial={initial} />
      </div>
    </main>
  );
}
