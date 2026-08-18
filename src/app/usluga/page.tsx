import PageHeader from "@/components/PageHeader";
import { PageContainer } from "@/components/ui";
import ServiceCalculatorForm from "./ServiceCalculatorForm";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stawka usługi" };

export default async function UslugaPage() {
  const settings = await getUserSettingsOrDefault();
  return (
    <PageContainer width="narrow">
      <PageHeader title="Stawka usługi" back={{ href: "/wiecej" }} />
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
    </PageContainer>
  );
}
