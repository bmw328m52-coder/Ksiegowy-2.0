import PageHeader from "@/components/PageHeader";
import { PageContainer } from "@/components/ui";
import { DEFAULT_RATES } from "@/lib/cabinetPricing";
import { getCabinetRates } from "@/lib/dao/cabinet_pricing";
import CabinetRatesForm from "./CabinetRatesForm";

export const metadata = { title: "Cennik szafek" };

export default async function CennikSzafekPage() {
  const { rates, saved, missing } = await getCabinetRates();

  return (
    <PageContainer width="app">
      <PageHeader title="Cennik szafek" back={{ href: "/materials" }} />
      <p className="-mt-2 text-sm text-[#6f6c66]">
        Koszt szafki liczy się z jej wymiarów według stawek z Twoich faktur (kuchnie Denis i Ani Turek, 2026), a cena dla klienta
        to koszt plus marża. Z tego cennika powstaje przybliżona cena przy skanie w zleceniu. Wszystkie kwoty brutto.
      </p>
      {missing && (
        <p className="rounded-xl border border-[#ecccc0] bg-[#fdf4f1] p-3 text-sm text-[#8a3b27]">
          Cennik działa na stawkach domyślnych. Żeby zapisywać własne, wgraj w Supabase migrację{" "}
          <span className="font-semibold">0052_cabinet_pricing.sql</span>.
        </p>
      )}
      <CabinetRatesForm initial={rates} defaults={DEFAULT_RATES} saved={saved} />
    </PageContainer>
  );
}
