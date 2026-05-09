import PageHeader from "@/components/PageHeader";
import ServiceCalculatorForm from "./ServiceCalculatorForm";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stawka usługi" };

export default async function UslugaPage() {
  const settings = await getUserSettingsOrDefault();
  return (
    <main className="flex flex-1 flex-col px-6 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Stawka usługi" back={{ href: "/" }} />
        <ServiceCalculatorForm
          defaultHourlyRate={settings.default_hourly_rate}
          defaultZusMonthly={settings.zus_monthly}
          defaultZusPelny={settings.zus_pelny}
          defaultZusMaly={settings.zus_maly}
          defaultZusUlga={settings.zus_ulga}
          defaultVatRate={settings.default_vat_rate}
          defaultIsVatPayer={settings.is_vat_payer}
          defaultTaxForm={settings.tax_form}
        />
      </div>
    </main>
  );
}
