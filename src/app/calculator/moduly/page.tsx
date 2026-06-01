import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ModuleCalculator from "./ModuleCalculator";
import {
  BOARDS as BOARDS_FALLBACK,
  FRONTS as FRONTS_FALLBACK,
  BLATY as BLATY_FALLBACK,
  UCHWYTY as UCHWYTY_FALLBACK,
  type BoardOption,
  type FrontOption,
  type BlatOption,
  type HandleOption,
} from "./catalog";
import { listCatalog } from "@/lib/dao/material_catalog";
import { listBindings, resolvePrices, grossToNet } from "@/lib/dao/calculator_bindings";

export const metadata = { title: "Kalkulator modułowy" };

export default async function ModulyCalculatorPage() {
  const [bindings, catalog] = await Promise.all([listBindings(), listCatalog()]);

  // Listy per kategoria filtrujemy z jednego pobranego cennika — bez osobnych
  // zapytań do bazy (wcześniej 4 dodatkowe round-tripy na podzbiory tych danych).
  const byCatUnit = (category: string, unit: string) =>
    catalog.filter((r) => r.category === category && r.unit === unit);
  const boardsRaw = byCatUnit("Płyty laminowane", "m2");
  const frontsRaw = byCatUnit("Fronty lakierowane MDF (JUKA)", "m2");
  const blatyRaw = byCatUnit("Blaty", "mb");
  const uchwytyRaw = byCatUnit("Uchwyty", "szt");

  const boards: BoardOption[] = boardsRaw
    .filter((r) => r.default_price_gross !== null)
    .map((r) => ({ id: r.id, name: r.name, price_m2: grossToNet(r.default_price_gross!) }));

  const fronts: FrontOption[] = frontsRaw
    .filter((r) => r.default_price_gross !== null)
    .map((r) => ({ id: r.id, name: r.name, price_m2: grossToNet(r.default_price_gross!) }));

  const blaty: BlatOption[] = blatyRaw
    .filter((r) => r.default_price_gross !== null)
    .map((r) => ({ id: r.id, name: r.name, price_mb: grossToNet(r.default_price_gross!) }));

  const uchwyty: HandleOption[] = uchwytyRaw
    .filter((r) => r.default_price_gross !== null)
    .map((r) => ({ id: r.id, name: r.name, price_szt: grossToNet(r.default_price_gross!) }));

  const priceById = new Map(catalog.map((c) => [c.id, c.default_price_gross] as const));
  const prices = resolvePrices(bindings, priceById);

  return (
    <main className="flex flex-1 flex-col px-6 py-6">
      <div className="w-full max-w-md sm:max-w-2xl mx-auto">
        <PageHeader title="Wycena modułowa" back={{ href: "/calculator" }} />
        <div className="flex items-center justify-between -mt-1 mb-4 gap-3">
          <p className="text-[12px] text-[#6b6661] flex-1">
            Klikasz moduły → wybierasz materiały → masz cenę.
            Po wstępnym OK, dokładny rozrys robisz w PRO100.
          </p>
          <Link
            href="/calculator/moduly/settings"
            className="text-[11px] text-[#a06f3f] underline-offset-2 hover:underline shrink-0"
          >
            Ustawienia cen
          </Link>
        </div>
        <ModuleCalculator
          boards={boards.length > 0 ? boards : BOARDS_FALLBACK}
          fronts={fronts.length > 0 ? fronts : FRONTS_FALLBACK}
          blaty={blaty.length > 0 ? blaty : BLATY_FALLBACK}
          uchwyty={uchwyty.length > 0 ? uchwyty : UCHWYTY_FALLBACK}
          prices={prices}
        />
      </div>
    </main>
  );
}
