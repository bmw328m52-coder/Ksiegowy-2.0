// Biblioteka szafek do szybkiego projektowania kuchni (przeciągnij na ścianę) i do auto-rozstawu ze skanu.
// Źródło: szafki odtworzone z realnych projektów Artura — „Denis" (28 szt. z OBJ z PRO100, scripts/pro100/cabs.txt)
// i „Ania Turek" (scripts/pro100/calibrate-turek.ts) — zlane po typie i wymiarze; `uses` = ile razy wystąpiły.
// Szafki z `source: "standard"` dopisane ręcznie (narożniki, których w projektach brak lub jest 1 sztuka).
// Wymiary korpusu w mm, bez nóżek/cokołu (jak w `Cab` z cabinetPricing.ts).

import type { Cab, CabKind } from "./cabinetPricing";

export type LibGroup = "lower" | "sink_app" | "corner" | "upper" | "flap" | "tall";

export const LIB_GROUP_LABELS: Record<LibGroup, string> = {
  lower: "Dolne",
  sink_app: "Zlew / zmywarka / płyta",
  corner: "Narożne",
  upper: "Górne",
  flap: "Nadstawki z klapą",
  tall: "Słupki",
};

export type LibCab = {
  id: string;
  name: string;
  group: LibGroup;
  /** Rodzaj do wyceny (cabinetPricing). */
  kind: CabKind;
  w: number;
  h: number;
  d: number;
  doors?: number;
  drawers?: number;
  shelves?: number;
  /** Wysokość dolnej krawędzi od podłogi (górne / nadstawki). Dolne i słupki: 0 (korpus na cokole). */
  elev: number;
  /** Narożnik: ramiona L (mm) — szerokość frontu po stronie A i B licząc od naroża. */
  corner?: { armA: number; armB: number; blind?: boolean };
  /** Rola w auto-rozstawie ze skanu. */
  role?: "sink" | "dishwasher" | "hob" | "oven" | "fridge";
  uses: number;
  source: "projekty" | "standard";
};

export const CABINET_LIBRARY: LibCab[] = [
  // ── dolne ────────────────────────────────────────────────────────────
  { id: "dol-drzwi-300", name: "Dolna 300 — drzwi", group: "lower", kind: "lower_doors", w: 300, h: 720, d: 530, doors: 1, shelves: 1, elev: 0, uses: 2, source: "projekty" },
  { id: "dol-drzwi-400", name: "Dolna 400 — drzwi", group: "lower", kind: "lower_doors", w: 400, h: 720, d: 530, doors: 1, shelves: 1, elev: 0, uses: 0, source: "standard" },
  { id: "dol-drzwi-450", name: "Dolna 450 — drzwi", group: "lower", kind: "lower_doors", w: 450, h: 720, d: 530, doors: 1, shelves: 1, elev: 0, uses: 0, source: "standard" },
  { id: "dol-drzwi-600", name: "Dolna 600 — drzwi", group: "lower", kind: "lower_doors", w: 600, h: 720, d: 530, doors: 1, shelves: 1, elev: 0, uses: 3, source: "projekty" },
  { id: "dol-drzwi-750", name: "Dolna 750 — drzwi", group: "lower", kind: "lower_doors", w: 750, h: 720, d: 530, doors: 1, shelves: 1, elev: 0, uses: 1, source: "projekty" },
  { id: "dol-drzwi-900", name: "Dolna 900 — 2 drzwi", group: "lower", kind: "lower_doors", w: 900, h: 720, d: 530, doors: 2, shelves: 1, elev: 0, uses: 0, source: "standard" },
  { id: "dol-drzwi-1200", name: "Dolna 1200 — 2 drzwi", group: "lower", kind: "lower_doors", w: 1200, h: 720, d: 530, doors: 2, shelves: 1, elev: 0, uses: 2, source: "projekty" },
  { id: "dol-szuf2-600", name: "Dolna 600 — 2 szuflady", group: "lower", kind: "lower_drawers", w: 600, h: 720, d: 510, drawers: 2, elev: 0, uses: 2, source: "projekty" },
  { id: "dol-szuf3-600", name: "Dolna 600 — 3 szuflady", group: "lower", kind: "lower_drawers", w: 600, h: 720, d: 510, drawers: 3, elev: 0, uses: 2, source: "projekty" },
  { id: "dol-szuf2-800", name: "Dolna 800 — 2 szuflady", group: "lower", kind: "lower_drawers", w: 800, h: 720, d: 510, drawers: 2, elev: 0, uses: 0, source: "standard" },
  { id: "dol-szuf3-800", name: "Dolna 800 — 3 szuflady", group: "lower", kind: "lower_drawers", w: 800, h: 720, d: 510, drawers: 3, elev: 0, uses: 0, source: "standard" },
  { id: "dol-szuf3-900", name: "Dolna 900 — 3 szuflady", group: "lower", kind: "lower_drawers", w: 900, h: 720, d: 510, drawers: 3, elev: 0, uses: 0, source: "standard" },

  // ── zlew / zmywarka / płyta ─────────────────────────────────────────
  { id: "zlew-600", name: "Zlewowa 600", group: "sink_app", kind: "sink", w: 600, h: 720, d: 510, doors: 1, elev: 0, role: "sink", uses: 0, source: "standard" },
  { id: "zlew-800", name: "Zlewowa 800 — 2 drzwi", group: "sink_app", kind: "sink", w: 800, h: 720, d: 510, doors: 2, elev: 0, role: "sink", uses: 0, source: "standard" },
  { id: "zlew-661", name: "Zlewowa 660", group: "sink_app", kind: "sink", w: 661, h: 720, d: 510, doors: 1, elev: 0, role: "sink", uses: 1, source: "projekty" },
  { id: "zmywarka-600", name: "Zmywarka 600 (front)", group: "sink_app", kind: "appliance_front", w: 600, h: 720, d: 0, elev: 0, role: "dishwasher", uses: 1, source: "projekty" },
  { id: "plyta-szuf-600", name: "Pod płytę 600 — szuflady", group: "sink_app", kind: "lower_drawers", w: 600, h: 720, d: 510, drawers: 2, elev: 0, role: "hob", uses: 0, source: "standard" },
  { id: "plyta-szuf-800", name: "Pod płytę 800 — szuflady", group: "sink_app", kind: "lower_drawers", w: 800, h: 720, d: 510, drawers: 2, elev: 0, role: "hob", uses: 0, source: "standard" },

  // ── narożne ─────────────────────────────────────────────────────────
  { id: "nar-dol-magic-1170", name: "Dolna narożna — Magic Corner 1170", group: "corner", kind: "lower_doors", w: 1170, h: 720, d: 530, doors: 1, elev: 0, corner: { armA: 600, armB: 1170 - 600 + 530 }, uses: 1, source: "projekty" },
  { id: "nar-dol-slepa-900", name: "Dolna narożna ślepa 900 (L)", group: "corner", kind: "lower_doors", w: 900, h: 720, d: 530, doors: 1, shelves: 1, elev: 0, corner: { armA: 900, armB: 530, blind: true }, uses: 0, source: "standard" },
  { id: "nar-dol-l-900", name: "Dolna narożna L 900×900 (drzwi składane)", group: "corner", kind: "lower_doors", w: 900, h: 720, d: 900, doors: 2, shelves: 1, elev: 0, corner: { armA: 900, armB: 900 }, uses: 0, source: "standard" },
  { id: "nar-gor-slepa-600", name: "Górna narożna ślepa 600", group: "corner", kind: "upper_doors", w: 600, h: 720, d: 340, doors: 1, elev: 1450, corner: { armA: 600, armB: 340, blind: true }, uses: 0, source: "standard" },
  { id: "nar-gor-l-600", name: "Górna narożna L 600×600", group: "corner", kind: "upper_doors", w: 600, h: 720, d: 600, doors: 2, elev: 1450, corner: { armA: 600, armB: 600 }, uses: 0, source: "standard" },

  // ── górne ────────────────────────────────────────────────────────────
  { id: "gor-300", name: "Górna 300", group: "upper", kind: "upper_doors", w: 300, h: 640, d: 340, doors: 1, shelves: 2, elev: 1431, uses: 1, source: "projekty" },
  { id: "gor-400", name: "Górna 400", group: "upper", kind: "upper_doors", w: 400, h: 640, d: 340, doors: 1, shelves: 2, elev: 1431, uses: 0, source: "standard" },
  { id: "gor-600", name: "Górna 600", group: "upper", kind: "upper_doors", w: 600, h: 640, d: 340, doors: 1, shelves: 2, elev: 1431, uses: 4, source: "projekty" },
  { id: "gor-750", name: "Górna 750", group: "upper", kind: "upper_doors", w: 750, h: 640, d: 340, doors: 1, shelves: 2, elev: 1431, uses: 1, source: "projekty" },
  { id: "gor-900", name: "Górna 900 — 2 drzwi", group: "upper", kind: "upper_doors", w: 900, h: 640, d: 340, doors: 2, shelves: 2, elev: 1431, uses: 1, source: "projekty" },
  { id: "gor-okap-600", name: "Górna pod okap 600 (niska)", group: "upper", kind: "upper_flap", w: 600, h: 360, d: 340, elev: 1790, uses: 0, source: "standard" },

  // ── nadstawki z klapą ───────────────────────────────────────────────
  { id: "klapa-600", name: "Nadstawka 600 — klapa", group: "flap", kind: "upper_flap", w: 600, h: 513, d: 540, elev: 1990, uses: 5, source: "projekty" },
  { id: "klapa-800", name: "Nadstawka 800 — klapa", group: "flap", kind: "upper_flap", w: 800, h: 418, d: 560, elev: 2083, uses: 0, source: "standard" },
  { id: "klapa-1200", name: "Nadstawka 1200 — 2 klapy", group: "flap", kind: "upper_flap", w: 1200, h: 418, d: 560, elev: 2083, uses: 2, source: "projekty" },

  // ── słupki ───────────────────────────────────────────────────────────
  { id: "slup-400", name: "Słupek 400", group: "tall", kind: "tall", w: 400, h: 2100, d: 510, doors: 2, shelves: 4, elev: 0, uses: 1, source: "projekty" },
  { id: "slup-600-piek", name: "Słupek 600 — piekarnik", group: "tall", kind: "tall", w: 600, h: 2100, d: 510, drawers: 2, doors: 1, shelves: 2, elev: 0, role: "oven", uses: 2, source: "projekty" },
  { id: "slup-600-szuf", name: "Słupek 600 — szuflady", group: "tall", kind: "tall", w: 600, h: 2100, d: 510, drawers: 5, doors: 1, elev: 0, uses: 1, source: "projekty" },
  { id: "slup-600-lod", name: "Słupek 600 — lodówka w zabudowie", group: "tall", kind: "tall", w: 600, h: 2100, d: 560, doors: 2, elev: 0, role: "fridge", uses: 0, source: "standard" },
  { id: "slup-800-spiz", name: "Słupek 800 — spiżarnia", group: "tall", kind: "tall", w: 806, h: 2100, d: 330, doors: 4, shelves: 4, elev: 0, uses: 1, source: "projekty" },
];

export const libById = (id: string): LibCab | undefined => CABINET_LIBRARY.find((c) => c.id === id);

/** Szafka z biblioteki → wejście do wyceny. Szerokość można zmienić (na wymiar). */
export function libToCab(c: LibCab, widthMm: number = c.w): Cab {
  return { kind: c.kind, w: widthMm, h: c.h, d: c.d, doors: c.doors, drawers: c.drawers, shelves: c.shelves };
}

/** Najczęściej używane na górze, potem wg szerokości. */
export function libByGroup(): Record<LibGroup, LibCab[]> {
  const out = { lower: [], sink_app: [], corner: [], upper: [], flap: [], tall: [] } as Record<LibGroup, LibCab[]>;
  for (const c of CABINET_LIBRARY) out[c.group].push(c);
  for (const g of Object.keys(out) as LibGroup[]) out[g].sort((a, b) => b.uses - a.uses || a.w - b.w);
  return out;
}
