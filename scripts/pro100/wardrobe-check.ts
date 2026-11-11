// Kontrola wyceny szafy: przykładowa szafa 3000 × 2700 × 650, drzwi przesuwne ×2 i ×3, oba systemy.
// Uruchom: node scripts/pro100/wardrobe-check.ts
import { DEFAULT_RATES, estimate, slideHardware, type WardrobeLike } from "../../src/lib/cabinetPricing.ts";

const base: WardrobeLike = {
  id: "w",
  width_mm: 3000,
  height_mm: 2700,
  depth_mm: 650,
  plinth_mm: 80,
  top_mm: 0,
  doors: "sliding",
  door_count: 2,
  construction: "box_back",
  sections: [
    { zones: [{ kind: "drawers", count: 3, height_mm: 600 }, { kind: "rail" }, { kind: "shelves", count: 1 }] },
    { zones: [{ kind: "shelves", count: 5 }] },
    { zones: [{ kind: "rail" }, { kind: "rail" }] },
  ],
};
const f = (n: number) => n.toFixed(0).padStart(7);
for (const [name, wd] of [
  ["przesuwne ×2", base],
  ["przesuwne ×3", { ...base, door_count: 3 }],
  ["uchylne ×6", { ...base, doors: "hinged", door_count: 6 }],
] as [string, WardrobeLike][]) {
  for (const slide of ["laguna", "gtv"] as const) {
    const e = estimate([], {}, DEFAULT_RATES, { wardrobes: [wd], slide });
    console.log(name.padEnd(14), slide.padEnd(7), "koszt", f(e.cost), "cena", f(e.price), "okucia drzwi", f(e.wardrobes[0].slide), JSON.stringify(Object.fromEntries(Object.entries(e.parts).map(([k, v]) => [k, Math.round(v)]))));
  }
}
console.log("para drzwi 2 m: Laguna", f(slideHardware(DEFAULT_RATES, "laguna", 2, 2000)), "GTV", f(slideHardware(DEFAULT_RATES, "gtv", 2, 2000)));
console.log("para drzwi 3 m: Laguna", f(slideHardware(DEFAULT_RATES, "laguna", 2, 3000)), "GTV", f(slideHardware(DEFAULT_RATES, "gtv", 2, 3000)));
