// Wycena kuchni → linie job_materials (KOSZT materiału brutto, jak reszta wyceny — cena dla klienta
// powstaje z marży liczonej w kalkulatorze / rentowności, nie tutaj). Suma linii = estimate.cost.
// Grupy (group_key) zgodne ze stroną wyceny: korpusy_i_okleina, fronty_lakier, fronty_uchwyty,
// blat, okucia_zawiasy / _szuflady / _silowniki / _nogi. Zawieszki i drobne → null (sekcja „luźne").

import type { Estimate, FrontType, Rates } from "../cabinetPricing";

export const KITCHEN_SOURCE_PREFIX = "kuchnia:";
/** Grupy, do których kuchnia wpisuje swoje linie — do wykrywania duplikatów z ręczną / auto wyceną. */
export const KITCHEN_GROUPS = [
  "korpusy_i_okleina",
  "fronty_lakier",
  "fronty_uchwyty",
  "blat",
  "okucia_zawiasy",
  "okucia_szuflady",
  "okucia_silowniki",
  "okucia_nogi",
];

export type MaterialLine = {
  auto_source: string;
  group_key: string | null;
  name: string;
  unit: string;
  qty: number;
  unit_price_gross: number;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

export function kitchenMaterialLines(est: Estimate, rates: Rates, fronts: FrontType): MaterialLine[] {
  const p = est.parts;
  const n = (f: (b: Estimate["items"][number]["bom"]) => number) => est.items.reduce((s, i) => s + f(i.bom), 0);
  const lines: MaterialLine[] = [];
  const lump = (key: string, group: string | null, name: string, value: number) => {
    if (value > 0.004) lines.push({ auto_source: KITCHEN_SOURCE_PREFIX + key, group_key: group, name, unit: "kpl", qty: 1, unit_price_gross: r2(value) });
  };
  const unit = (key: string, group: string | null, name: string, qty: number, price: number) => {
    if (qty > 0 && price > 0) lines.push({ auto_source: KITCHEN_SOURCE_PREFIX + key, group_key: group, name, unit: "szt", qty, unit_price_gross: r2(price) });
  };

  lump("korpusy", "korpusy_i_okleina", "Kuchnia — płyta, cięcie, oklejanie, plecy HDF", p.board + p.cutting + p.edging + p.hdf);
  lump("fronty", "fronty_lakier", fronts === "laminate" ? "Kuchnia — fronty z płyty laminowanej" : "Kuchnia — fronty zamawiane", p.fronts);
  lump("blat", "blat", "Kuchnia — blat (mb wg szafek dolnych)", p.worktop);
  unit("zawiasy", "okucia_zawiasy", "Zawias Blum CLIP top BLUMOTION", n((b) => b.hinges), rates.hinge);
  unit("szuflady", "okucia_szuflady", "Szuflada Blum — komplet", n((b) => b.drawers), rates.drawer_set);
  unit("klapy", "okucia_silowniki", "Aventos — komplet na front", n((b) => b.flaps), rates.flap_set);
  unit("nogi", "okucia_nogi", "Nóżka regulowana", n((b) => b.legs), rates.leg);
  unit("uchwyty", "fronty_uchwyty", "Uchwyt / system otwierania", n((b) => b.handles), rates.handle);
  unit("zawieszki", null, "Zawieszka + szyna montażowa", n((b) => b.hung), rates.hang_set);
  lump("drobne", null, "Kuchnia — drobne, transport (narzut %)", p.overhead);
  return lines;
}
