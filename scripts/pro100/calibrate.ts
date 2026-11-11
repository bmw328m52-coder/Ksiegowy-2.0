// Kalibracja cennika szafek: szafki z projektu PRO100 „DANIS" (cabs.txt) wycenione modelem
// z src/lib/cabinetPricing.ts kontra faktury kosztowe kuchni Denis (10.2026, brutto).
// Uruchom: node scripts/pro100/calibrate.ts
import { readFileSync } from "node:fs";
import { bomOf, costOfBom, DEFAULT_RATES, estimate, sumParts, type Cab, type CabKind } from "../../src/lib/cabinetPricing.ts";

const txt = new TextDecoder("windows-1250").decode(readFileSync(new URL("./cabs.txt", import.meta.url)));
const cabs: Cab[] = [];
for (const l of txt.split(/\r?\n/)) {
  const m = l.match(/^(\S+(?: na blat)?)\s+(\d+)\D+(\d+)\D+(\d+) wys\.od pod\S+\s+(\d+)\s+fronty:(\d+) (\[.*?\])\s+szuflady:(\d+) p\S+ki:(\d+)/);
  if (!m) continue;
  const [, type, w, h, d, , nf, fr, dr, sh] = m;
  const fronts = [...fr.matchAll(/\((\d+), (\d+)\)/g)].map((x) => (Number(x[1]) * Number(x[2])) / 1e6);
  const drawers = Number(dr);
  const kind: CabKind = type.startsWith("dolna")
    ? drawers > 0 ? "lower_drawers" : "lower_doors"
    : type.startsWith("nadstawka") ? "upper_flap"
    : type.startsWith("s") ? "tall" : "upper_doors";
  cabs.push({
    kind, w: Number(w), h: Number(h), d: Number(d), drawers, shelves: Number(sh),
    doors: kind === "upper_flap" ? 0 : Math.max(Number(nf) - (kind === "lower_drawers" ? Number(nf) : 0), 0),
    front_m2: fronts.reduce((a, b) => a + b, 0),
  });
}

const r = { ...DEFAULT_RATES, board_extra_pct: 0, edge_extra_pct: 0, front_extra_pct: 0, overhead_pct: 0 };
const bom = cabs.map(bomOf).reduce((a, b) => {
  for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] += b[k];
  return a;
});
// Faktury Denis (brutto / ilości).
const actual = {
  board_m2: 7.5 * 5.88 + 3 * 5.796 + 0.5 * 5.88, board: 1569.17 + 1677.84 + 138.5,
  cut_mb: 334.2 + 6, cutting: 587.83 + 11.14 + 28.11,
  edge_mb: 167 + 8 + 3, edging: 733.31 + 37.2 + 15.5 + 35.65 + 3.36 + 131.76 + 167.38 + 24.8 + 8.98,
  hdf_m2: 2 * 5.9, hdf: 100.12,
  front_m2: 12.38, fronts: 4429.03,
  worktop: 1046.12 + 895.56 + 63.21 + 13.17 + 18.12 + 7.97 + 24.24,
};
const f = (n: number) => n.toFixed(1).padStart(9);
console.log(`szafek ${cabs.length}`);
console.log(`płyta m²   model ${f(bom.board_m2)}  faktury ${f(actual.board_m2)}  → dodatek ${((actual.board_m2 / bom.board_m2 - 1) * 100).toFixed(0)}%   średnio ${(actual.board / actual.board_m2).toFixed(2)} zł/m²`);
console.log(`cięcie     ${(actual.cut_mb / actual.board_m2).toFixed(2)} mb/m², ${(actual.cutting / actual.cut_mb).toFixed(2)} zł/mb`);
console.log(`okleina mb model ${f(bom.edge_mb)}  faktury ${f(actual.edge_mb)}  → dodatek ${((actual.edge_mb / bom.edge_mb - 1) * 100).toFixed(0)}%   ${(actual.edging / actual.edge_mb).toFixed(2)} zł/mb`);
console.log(`HDF m²     model ${f(bom.hdf_m2)}  faktury ${f(actual.hdf_m2)}  ${(actual.hdf / actual.hdf_m2).toFixed(2)} zł/m²`);
console.log(`fronty m²  model ${f(bom.front_m2)}  faktury ${f(actual.front_m2)}  → dodatek ${((actual.front_m2 / bom.front_m2 - 1) * 100).toFixed(0)}%   ${(actual.fronts / actual.front_m2).toFixed(2)} zł/m²`);
console.log(`blat mb    model ${f(bom.worktop_mb)}  faktury ${f(actual.worktop)} zł → ${(actual.worktop / bom.worktop_mb).toFixed(0)} zł/mb szafek dolnych`);
console.log(`okucia szt: zawiasy ${bom.hinges} szuflady ${bom.drawers} klapy ${bom.flaps} nogi ${bom.legs} wiszące ${bom.hung} uchwyty ${bom.handles}`);
console.log("\n— model ze stawkami domyślnymi —");
// Dodatki tej kuchni: Magic Corner, Magic Cook (szafka 300), panel nad blatem 4,1 mb,
// LED 4 mb + zasilacz, blat 2 m pogłębiany do ~930 (wchodzi w okno). Cargo nie było.
// 11 szuflad z projektu = 7 zwykłych + 4 wewnętrzne; 9 kpl z faktury poszło na zapas (ok. 1500 zł).
const e = estimate(cabs, { magic_corner: 1, magic_cook: 1, wall_panel_mb: 4.1, led_mb: 4, led_psu: 1, worktop_deep_mb: 2 }, DEFAULT_RATES);
for (const [k, v] of Object.entries(e.parts)) console.log(k.padEnd(10), f(v));
console.log("dodatki   ", f(e.extrasCost));
console.log("koszt     ", f(e.cost), "  faktury 23511.9 (w tym ~1500 zł szuflad na zapas: 20 kpl kupione, 7 + 4 wewn. użyte)");
console.log("cena      ", f(e.price), `  sprzedane 35500.0 → narzut na fakturach ${((35500 / 22000 - 1) * 100).toFixed(0)}%, na modelu ${((35500 / e.cost - 1) * 100).toFixed(0)}%`);
void r; void costOfBom; void sumParts;
