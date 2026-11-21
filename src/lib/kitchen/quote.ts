// Projekt kuchni → wycena z cennika szafek (ta sama funkcja estimate() co skan i /cennik-szafek).
// Cena brutto dla klienta; blendy, cokoły i panele są w dodatkach procentowych cennika (board_extra_pct, front_extra_pct),
// więc nie dopisujemy ich drugi raz. Wynik = migawka do zapisania przy zleceniu.

import { estimate, type Estimate, type Rates } from "../cabinetPricing";
import { libById, libToCab } from "../cabinetLibrary";
import { hardwareFor } from "./hardware";
import { dimsOf, layerOf } from "./rules";
import type { HardwareLine, Issue, KitchenProject, KitchenQuoteSnapshot, Room } from "./types";

export type KitchenQuote = {
  estimate: Estimate;
  snapshot: KitchenQuoteSnapshot;
  hardwareIssues: Issue[];
  /** Cena każdej szafki w kolejności project.items (do podglądu przy wybranym elemencie). */
  priceByUid: Record<string, number>;
};

export function quoteKitchen(room: Room, project: KitchenProject, rates: Rates): KitchenQuote {
  const placed = project.items.filter((p) => libById(p.libId) && room.walls.some((w) => w.id === p.wall));
  const cabs = placed.map((p) => {
    const lib = libById(p.libId)!;
    const wall = room.walls.find((w) => w.id === p.wall)!;
    const d = dimsOf(p, wall);
    return { ...libToCab(lib, p.w), h: d ? d.z1 - d.z0 : lib.h };
  });
  const est = estimate(cabs, {}, rates, {
    fronts: project.fronts,
    ...(project.margin_pct != null ? { margin_pct: project.margin_pct } : {}),
  });
  const { lines, issues } = hardwareFor(room, placed);

  const mb = (pred: (l: ReturnType<typeof libById> & object) => boolean) =>
    placed.reduce((s, p) => {
      const l = libById(p.libId)!;
      return pred(l) ? s + p.w / 1000 : s;
    }, 0);
  const priceByUid: Record<string, number> = {};
  est.items.forEach((it, i) => (priceByUid[placed[i].uid] = it.price));

  const snapshot: KitchenQuoteSnapshot = {
    at: new Date().toISOString(),
    cabinets: placed.length,
    cost: Math.round(est.cost),
    price: Math.round(est.price),
    margin_pct: est.margin_pct,
    worktop_mb: Math.round(mb((l) => layerOf(l) === "low") * 100) / 100,
    plinth_mb: Math.round(mb((l) => layerOf(l) !== "up") * 100) / 100,
    fronts: project.fronts,
    hardware: lines as HardwareLine[],
  };
  return { estimate: est, snapshot, hardwareIssues: issues, priceByUid };
}
