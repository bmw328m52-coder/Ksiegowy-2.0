import PageHeader from "@/components/PageHeader";
import { listCatalog } from "@/lib/dao/material_catalog";
import { listAutopriceBindings, AUTOPRICE_SLOTS } from "@/lib/dao/quote_autoprice";
import AutopriceForm from "./AutopriceForm";

export const metadata = { title: "Domyślne ceny wyceny" };

export default async function AutoWycenaPage() {
  const [catalog, bindings] = await Promise.all([
    listCatalog(),
    listAutopriceBindings(),
  ]);

  const current: Record<string, string> = {};
  for (const b of bindings) current[b.slot] = b.catalog_id;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Domyślne ceny wyceny" back={{ href: "/materials" }} />

        <p className="text-sm text-zinc-500 mb-4">
          Przypisz pozycję z cennika do każdej pozycji pomiaru. Wtedy w wycenie,
          po kliknięciu <span className="font-medium">„Przelicz z pomiaru”</span>,
          ilości i rozpiska zawiasów/siłowników wycenią się same.
        </p>

        <AutopriceForm
          slots={AUTOPRICE_SLOTS.map((s) => ({
            key: s.key,
            label: s.label,
            section: s.section,
            preferredCategories: s.preferredCategories,
          }))}
          catalog={catalog.map((c) => ({
            id: c.id,
            name: c.name,
            unit: c.unit,
            category: c.category,
            default_price_gross: c.default_price_gross,
          }))}
          current={current}
        />
      </div>
    </main>
  );
}
