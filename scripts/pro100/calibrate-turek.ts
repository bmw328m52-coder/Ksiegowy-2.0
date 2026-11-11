// Druga kalibracja cennika szafek: kuchnia „Ania Turek" (08.2026) — szafki odtworzone z listy formatek
// i rysunków wymiarowych, fronty z płyty laminowanej (biel szlachetna), bez osobnej faktury na fronty.
// Uruchom: node scripts/pro100/calibrate-turek.ts
import { bomOf, DEFAULT_RATES, estimate, type Cab } from "../../src/lib/cabinetPricing.ts";

const f2 = (...p: [number, number][]) => p.reduce((s, [a, b]) => s + (a * b) / 1e6, 0);
const cabs: Cab[] = [
  // dolne (korpus 720)
  { kind: "lower_doors", w: 1170, h: 720, d: 530, doors: 1, shelves: 0, front_m2: f2([714, 583]) }, // narożna, Magic Corner
  { kind: "lower_drawers", w: 600, h: 720, d: 510, drawers: 3, front_m2: f2([283, 597], [283, 597], [140, 597]) },
  { kind: "sink", w: 661, h: 720, d: 510, doors: 1, front_m2: f2([714, 658]) },
  { kind: "appliance_front", w: 599, h: 720, d: 0, front_m2: f2([714, 597]) },
  { kind: "lower_drawers", w: 632, h: 720, d: 510, drawers: 2, front_m2: f2([355, 628], [355, 628]) },
  { kind: "lower_doors", w: 319, h: 720, d: 510, doors: 1, shelves: 1, front_m2: f2([714, 316]) },
  { kind: "lower_drawers", w: 600, h: 720, d: 510, drawers: 2, front_m2: f2([355, 597], [355, 597]) },
  // słupki
  { kind: "tall", w: 600, h: 2183, d: 510, drawers: 2, doors: 1, shelves: 2, front_m2: f2([355, 595], [355, 595], [860, 594]) }, // piekarnik
  { kind: "tall", w: 806, h: 2183, d: 330, doors: 4, shelves: 4, front_m2: f2([1461, 803], [714, 803], [1848, 378], [1848, 378]) }, // + drzwi spiżarni
  // górne 583 × 340
  { kind: "upper_doors", w: 200, h: 583, d: 340, doors: 1, front_m2: f2([217, 596]) },
  { kind: "upper_doors", w: 580, h: 583, d: 340, doors: 1, front_m2: f2([595, 596]) },
  { kind: "upper_doors", w: 555, h: 583, d: 340, doors: 1, front_m2: f2([571, 596]) },
  { kind: "upper_doors", w: 555, h: 583, d: 340, doors: 1, front_m2: f2([571, 596]) },
  { kind: "upper_doors", w: 901, h: 583, d: 340, doors: 1, front_m2: f2([571, 596]) },
  // nadstawki z klapą 362 × 560
  { kind: "upper_flap", w: 760, h: 362, d: 560, front_m2: f2([354, 757]) },
  { kind: "upper_flap", w: 1290, h: 362, d: 560, front_m2: f2([354, 757], [354, 595]) },
  { kind: "upper_flap", w: 600, h: 362, d: 560, front_m2: 0 },
];

const bom = cabs.map(bomOf).reduce((a, b) => {
  for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] += b[k];
  return a;
});
// Faktury Turek (brutto / ilości). Płyta: 8 ark. biel + 2 ark. dąb artisan, arkusz 2800×2100.
const actual = {
  board_m2: 10 * 5.88, board: 2158.8 + 433.43,
  list_m2: 47.84, list_front_m2: 9.16, list_edge_mb: 216.6,
  cut_mb: 349.4, cutting: 614.56,
  edge_mb: 263, edging: 1154.86 + 83.69 + 290.49,
  hdf: 100.12, frez: 167.6,
  worktop: 757.58 + 191.77 + 47.76,
  wall_panel: 373.72,
  drawers: 771.33 + 2 * 287.08 + 461.51, flaps: 210.33 + 71.64 + 72.82,
  hinges4: 85.46, hang: 88.06 + 46.75, handles: 291.94, legs: 142.67,
  magic_corner: 1504.22, led: 200.99,
  total: 11817.58, sold: 24000,
};
const f = (n: number) => n.toFixed(1).padStart(9);
console.log(`szafek ${cabs.length}`);
console.log(`płyta korpusów m²  model ${f(bom.board_m2)}  lista formatek bez frontów ${f(actual.list_m2 - actual.list_front_m2)}  kupione ${f(actual.board_m2)} (z frontami)`);
console.log(`  kupione − fronty z listy = ${f(actual.board_m2 - actual.list_front_m2 * 1.23)} → dodatek do modelu ${(((actual.board_m2 - actual.list_front_m2 * 1.23) / bom.board_m2 - 1) * 100).toFixed(0)}%   ${(actual.board / actual.board_m2).toFixed(2)} zł/m²`);
console.log(`cięcie     ${(actual.cut_mb / actual.board_m2).toFixed(2)} mb/m², ${(actual.cutting / actual.cut_mb).toFixed(2)} zł/mb`);
console.log(`okleina mb model ${f(bom.edge_mb)}  faktura ${f(actual.edge_mb)} (lista ${actual.list_edge_mb})  ${(actual.edging / actual.edge_mb).toFixed(2)} zł/mb`);
console.log(`fronty m²  model ${f(bom.front_m2)}  lista ${f(actual.list_front_m2)}`);
console.log(`HDF m²     model ${f(bom.hdf_m2)}  faktura ${f(actual.hdf)} zł`);
console.log(`blat       szafki dolne ${f(bom.worktop_mb)} mb, faktura ${f(actual.worktop)} zł → ${(actual.worktop / bom.worktop_mb).toFixed(0)} zł/mb`);
console.log(`okucia szt: zawiasy ${bom.hinges} szuflady ${bom.drawers} klapy ${bom.flaps} nogi ${bom.legs} wiszące ${bom.hung} uchwyty ${bom.handles}`);
console.log(`  faktury: szuflada ${(actual.drawers / 10).toFixed(0)} zł/kpl (+ mocowania), klapa HK-S ${(actual.flaps / 4).toFixed(0)} zł, uchwyt ${(actual.handles / 21).toFixed(1)}, noga ${(actual.legs / 36).toFixed(2)}`);

console.log("\n— model ze stawkami domyślnymi, fronty z płyty —");
const e = estimate(cabs, { magic_corner: 1, wall_panel_lam_mb: 3.9, led_mb: 5, led_psu: 1 }, DEFAULT_RATES, { fronts: "laminate" });
for (const [k, v] of Object.entries(e.parts)) console.log(k.padEnd(10), f(v));
console.log("dodatki   ", f(e.extrasCost));
console.log("koszt     ", f(e.cost), `  faktury ${actual.total} (bez ~22 zawiasów z zapasu ≈ 320 zł)`);
console.log("cena      ", f(e.price), `  sprzedane ${actual.sold} → narzut na fakturach ${((actual.sold / actual.total - 1) * 100).toFixed(0)}%, na modelu ${((actual.sold / e.cost - 1) * 100).toFixed(0)}%`);
