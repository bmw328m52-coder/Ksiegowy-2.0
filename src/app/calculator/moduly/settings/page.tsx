import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { fmtPLN } from "@/lib/format";
import { listCatalog } from "@/lib/dao/material_catalog";
import { listBindings, SLOTS } from "@/lib/dao/calculator_bindings";
import { PRICES } from "../catalog";
import { setBindingAction } from "./actions";

export const metadata = { title: "Ustawienia cen — kalkulator" };

const VAT_DEFAULT = 1.23;

export default async function CalcSettingsPage() {
  const [catalog, bindings] = await Promise.all([listCatalog(), listBindings()]);
  const bindingMap = new Map(bindings.map((b) => [b.slot, b.catalog_id] as const));

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Ustawienia cen" back={{ href: "/calculator/moduly" }} />
        <p className="text-[12px] text-[#6b6661] -mt-1 mb-4">
          Przypisz pozycję katalogu do każdego slotu BOM. Brak wyboru = używamy wartości domyślnej.
        </p>

        <div className="flex flex-col gap-3">
          {SLOTS.map((slot) => {
            const items = catalog.filter((c) => c.unit === slot.unit);
            const preferred = items.filter((c) =>
              slot.preferredCategories.includes(c.category ?? ""),
            );
            const others = items.filter(
              (c) => !slot.preferredCategories.includes(c.category ?? ""),
            );
            const selectedId = bindingMap.get(slot.key) ?? "";
            const selectedItem = items.find((c) => c.id === selectedId);
            const effectiveNet =
              selectedItem?.default_price_gross != null
                ? selectedItem.default_price_gross / VAT_DEFAULT
                : PRICES[slot.key];

            return (
              <section
                key={slot.key}
                className="rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#282624]">{slot.label}</h2>
                  <span className="text-[10px] uppercase tracking-wide text-[#9c9081]">
                    {slot.unit}
                  </span>
                </div>

                <form action={setBindingAction} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="slot" value={slot.key} />
                  <select
                    name="catalog_id"
                    defaultValue={selectedId}
                    className="w-full h-11 px-3 rounded-lg border border-zinc-300 bg-white text-sm text-[#282624]"
                  >
                    <option value="">
                      — brak (użyj domyślnej {fmtPLN(PRICES[slot.key])}/{slot.unit}) —
                    </option>
                    {preferred.length > 0 && (
                      <SlotGroup label="Sugerowane" items={preferred} unit={slot.unit} />
                    )}
                    {others.length > 0 && (
                      <SlotGroup label="Inne pozycje" items={others} unit={slot.unit} />
                    )}
                  </select>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-[#6b6661]">
                      W kalkulatorze: <strong>{fmtPLN(effectiveNet)}/{slot.unit}</strong> netto
                      {selectedItem ? " (z katalogu)" : " (domyślna)"}
                    </p>
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 rounded-md bg-[#a06f3f] text-white font-medium active:bg-[#7d5530]"
                    >
                      Zapisz
                    </button>
                  </div>
                </form>
              </section>
            );
          })}
        </div>

        {catalog.length === 0 && (
          <p className="text-center text-sm text-zinc-500 py-6">
            Katalog jest pusty.{" "}
            <Link href="/materials" className="text-[#a06f3f] underline">
              Dodaj materiały
            </Link>{" "}
            albo wgraj starter.
          </p>
        )}
      </div>
    </main>
  );
}

function SlotGroup({
  label,
  items,
  unit,
}: {
  label: string;
  items: { id: string; name: string; default_price_gross: number | null }[];
  unit: string;
}) {
  return (
    <optgroup label={label}>
      {items.map((c) => {
        const priceNet =
          c.default_price_gross != null ? c.default_price_gross / VAT_DEFAULT : null;
        const suffix = priceNet != null ? ` — ${fmtPLN(priceNet)}/${unit} netto` : " — brak ceny";
        return (
          <option key={c.id} value={c.id}>
            {c.name}
            {suffix}
          </option>
        );
      })}
    </optgroup>
  );
}

