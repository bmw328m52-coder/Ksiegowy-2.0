// Okucia szafek z projektu: zawiasy Blum CLIP top, szuflady, mechaniczne Aventos (bez siłowników gazowych!).
// Ilości bierze z bomOf() (ten sam rachunek co cennik), więc nic nie jest liczone podwójnie —
// linie służą do zamówienia / listy zakupów; cena siedzi już w stawkach cennika szafek.
// Numery katalogowe tylko te potwierdzone (ściąga zawiasów). Aventos: dobór siłownika wg LF, nie zgadujemy.

import { bomOf } from "../cabinetPricing";
import { libById, libToCab } from "../cabinetLibrary";
import type { AventosKind, HardwareLine, Issue, Placed, Room } from "./types";
import { dimsOf } from "./rules";

export const AVENTOS_LABELS: Record<AventosKind, string> = {
  HK: "Aventos HK (klapa w górę, 1 front)",
  HF: "Aventos HF (uchylno-składany, 2 fronty)",
  HL: "Aventos HL (równoległy)",
};

/** Zakresy wysokości korpusu potwierdzone w cenniku (ramiona HF 480–900, podnośniki HL 300–580). */
const AVENTOS_RANGE: Partial<Record<AventosKind, [number, number]>> = { HF: [480, 900], HL: [300, 580] };

/** Domyślne Aventos dla szafki z klapą: HK; wysoka nadstawka (≥ 480) z dwoma frontami → HF, niska szeroka → HL. */
export function defaultAventos(h: number, w: number): AventosKind {
  return h >= 480 && w >= 900 ? "HF" : "HK";
}

const add = (m: Map<string, HardwareLine>, key: string, name: string, qty: number, note?: string) => {
  if (qty <= 0) return;
  const cur = m.get(key);
  if (cur) cur.qty += qty;
  else m.set(key, { key, name, qty, priced_by: "cabinet_rates", note });
};

export function hardwareFor(room: Room, items: Placed[]): { lines: HardwareLine[]; issues: Issue[] } {
  const m = new Map<string, HardwareLine>();
  const issues: Issue[] = [];
  for (const p of items) {
    const lib = libById(p.libId);
    const wall = room.walls.find((w) => w.id === p.wall);
    if (!lib || !wall) continue;
    const d = dimsOf(p, wall);
    const h = d ? d.z1 - d.z0 : lib.h;
    const bom = bomOf({ ...libToCab(lib, p.w), h });

    const wide = !!lib.corner; // narożne: drzwi składane / ślepe — szerszy kąt otwarcia
    add(m, wide ? "hinge-155" : "hinge-110", wide ? "Zawias Blum CLIP top BLUMOTION 155° (71B7550)" : "Zawias Blum CLIP top BLUMOTION 110° (71B3550)", bom.hinges);
    add(m, `drawer-${p.drawer_system ?? "merivobox"}`, p.drawer_system === "legrabox" ? "Szuflada Blum Legrabox (komplet)" : "Szuflada Blum Merivobox (komplet)", bom.drawers);
    if (bom.flaps > 0) {
      const kind = p.aventos ?? defaultAventos(h, p.w);
      add(m, `aventos-${kind}`, `${AVENTOS_LABELS[kind]} — komplet na front`, bom.flaps, "Siłownik dobrać wg LF (wysokość × ciężar frontu); ramiona wg wysokości korpusu.");
      const r = AVENTOS_RANGE[kind];
      if (r && (h < r[0] || h > r[1]))
        issues.push({ level: "warn", code: "aventos_range", msg: `${lib.name}: Aventos ${kind} jest w cenniku dla wysokości ${r[0]}–${r[1]} mm, a korpus ma ${Math.round(h)} mm.`, uid: p.uid, wall: p.wall });
    }
    add(m, "leg", "Nóżka regulowana", bom.legs);
    add(m, "hung", "Zawieszka + szyna montażowa", bom.hung);
    add(m, "handle", "Uchwyt / system otwierania (TIP-ON lub frez)", bom.handles);
  }
  return { lines: [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "pl")), issues };
}
