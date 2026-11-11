// Cennik szafek: koszt szafki liczony z jej wymiarów (płyta, plecy, cięcie, oklejanie, fronty, okucia)
// według stawek z realnych faktur, plus narzut (marża) → przybliżona cena dla klienta.
// Wszystkie kwoty BRUTTO. Stawki domyślne = środek z dwóch kuchni: „Denis" (10.2026, fronty zamawiane)
// i „Ania Turek" (08.2026, fronty z płyty) — porównanie model ↔ faktury: scripts/pro100/calibrate*.ts.

export type CabKind =
  | "lower_doors"
  | "lower_drawers"
  | "sink"
  | "upper_doors"
  | "upper_flap"
  | "tall"
  | "appliance_front"
  | "skip";

export const CAB_KIND_LABELS: Record<CabKind, string> = {
  lower_doors: "Dolna — drzwi",
  lower_drawers: "Dolna — szuflady",
  sink: "Zlewowa",
  upper_doors: "Górna — drzwi",
  upper_flap: "Górna — klapa (Aventos)",
  tall: "Słupek",
  appliance_front: "Sam front (zmywarka)",
  skip: "Pomiń",
};

/** Szafka do wyceny. Wymiary korpusu w mm (bez nóżek / cokołu). */
export type Cab = {
  kind: CabKind;
  w: number;
  h: number;
  d: number;
  /** Nadpisania domyślnego wyposażenia (np. z projektu PRO100). */
  doors?: number;
  drawers?: number;
  shelves?: number;
  /** Realna powierzchnia frontów, gdy znana. */
  front_m2?: number;
};

export type Extra = { key: string; name: string; unit: string; price: number };

export type Rates = {
  /** Narzut na koszt w % — robocizna + zysk. Cena = koszt × (1 + marża).
   *  Denis wyszedł na 70% (koszt 20,8 tys. → 35,5 tys.), Turek na 106% (11,7 tys. → 24 tys.); domyślnie środek. */
  margin_pct: number;
  /** Płyta korpusu, sam materiał, zł/m². */
  board_m2: number;
  /** Odpad z rozkroju + elementy spoza szafek (blendy, cokoły, panele boczne), % do m² z modelu. */
  board_extra_pct: number;
  /** Cięcie: zł/mb i ile mb cięcia przypada na m² kupionej płyty. */
  cut_mb: number;
  cut_mb_per_m2: number;
  /** Oklejanie all-in (obrzeże + usługa), zł/mb. */
  edge_mb: number;
  edge_extra_pct: number;
  hdf_m2: number;
  /** Fronty zł/m² i dodatek na blendy / panele frontowe w %. */
  front_m2: number;
  /** Fronty z płyty laminowanej (materiał + cięcie + oklejanie + frez pod uchwyt), zł/m². */
  front_laminate_m2: number;
  front_extra_pct: number;
  worktop_mb: number;
  hinge: number;
  drawer_set: number;
  flap_set: number;
  leg: number;
  /** Zawieszki + odcinek szyny na jedną szafkę wiszącą. */
  hang_set: number;
  handle: number;
  /** Drobne: wkręty, kleje, pakowanie, transport, paliwo — % od kosztu materiału. */
  overhead_pct: number;
  extras: Extra[];
};

export const DEFAULT_RATES: Rates = {
  margin_pct: 88,
  board_m2: 48,
  board_extra_pct: 60,
  cut_mb: 1.8,
  cut_mb_per_m2: 5.6,
  edge_mb: 6.15,
  edge_extra_pct: 120,
  hdf_m2: 8.49,
  front_m2: 358,
  front_laminate_m2: 115,
  front_extra_pct: 19,
  worktop_mb: 300,
  hinge: 14.43,
  drawer_set: 190,
  flap_set: 90,
  leg: 3.5,
  hang_set: 13.5,
  handle: 13,
  overhead_pct: 4,
  extras: [
    { key: "cargo_tall", name: "Cargo wysokie (Dispensa)", unit: "szt", price: 2483 },
    { key: "magic_corner", name: "Magic Corner", unit: "szt", price: 1504 },
    { key: "led_mb", name: "LED pod szafkami", unit: "mb", price: 45 },
    { key: "led_psu", name: "Zasilacz LED 24 V", unit: "szt", price: 159 },
    { key: "wall_panel_mb", name: "Panel ścienny nad blatem", unit: "mb", price: 253 },
    { key: "wall_panel_lam_mb", name: "Ścianka przyblatowa z laminatu", unit: "mb", price: 91 },
    { key: "magic_cook", name: "Magic Cook (Peka) do szafki 300", unit: "szt", price: 736 },
    { key: "inner_drawer", name: "Szuflada wewnętrzna", unit: "szt", price: 215 },
    { key: "worktop_deep_mb", name: "Blat pogłębiany (pod okno) — dopłata", unit: "mb", price: 193 },
  ],
};

/** Scala zapisane stawki z domyślnymi (nowe pola dostają wartość domyślną). */
export function mergeRates(saved: Partial<Rates> | null | undefined): Rates {
  const out: Rates = { ...DEFAULT_RATES, extras: DEFAULT_RATES.extras.map((e) => ({ ...e })) };
  if (!saved) return out;
  for (const k of Object.keys(DEFAULT_RATES) as (keyof Rates)[]) {
    if (k === "extras") continue;
    const v = Number(saved[k]);
    if (saved[k] != null && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  if (Array.isArray(saved.extras)) {
    out.extras = saved.extras
      .filter((e) => e && typeof e.name === "string" && e.name.trim() && Number.isFinite(Number(e.price)))
      .map((e, i) => ({ key: e.key || `extra_${i}`, name: e.name.trim(), unit: e.unit || "szt", price: Number(e.price) }));
  }
  return out;
}

/** Zużycie materiału i okuć jednej szafki. */
export type Bom = {
  board_m2: number;
  hdf_m2: number;
  edge_mb: number;
  front_m2: number;
  hinges: number;
  drawers: number;
  flaps: number;
  legs: number;
  hung: number;
  handles: number;
  worktop_mb: number;
};

const ZERO: Bom = { board_m2: 0, hdf_m2: 0, edge_mb: 0, front_m2: 0, hinges: 0, drawers: 0, flaps: 0, legs: 0, hung: 0, handles: 0, worktop_mb: 0 };

const hingesPerDoor = (h: number) => (h < 0.9 ? 2 : h < 1.6 ? 3 : h < 2.0 ? 4 : 5);

export function bomOf(c: Cab): Bom {
  if (c.kind === "skip") return { ...ZERO };
  const w = c.w / 1000, h = c.h / 1000, d = c.d / 1000;
  if (c.kind === "appliance_front") {
    return { ...ZERO, front_m2: c.front_m2 ?? w * h, handles: 1, worktop_mb: w };
  }
  const lower = c.kind === "lower_doors" || c.kind === "lower_drawers" || c.kind === "sink";
  const hung = c.kind === "upper_doors" || c.kind === "upper_flap";
  const tall = c.kind === "tall";

  const drawers = c.drawers ?? (c.kind === "lower_drawers" ? 3 : 0);
  const shelves =
    c.shelves ?? (c.kind === "lower_doors" ? 1 : hung ? (h >= 0.6 ? 2 : h >= 0.45 ? 1 : 0) : tall ? (drawers > 0 ? 2 : 4) : 0);
  const doors =
    c.doors ??
    (c.kind === "lower_drawers" || c.kind === "upper_flap" ? 0 : tall ? (w > 0.6 ? 4 : 2) : w > 0.6 ? 2 : 1);

  // Korpus: boki + poziomy (dolna: dno + 2 trawersy, reszta: dno + wieniec) + półki + cokół + skrzynki szuflad.
  let board = 2 * h * d + (lower ? w * d + 2 * w * 0.1 : 2 * w * d) + shelves * w * Math.max(d - 0.03, 0);
  let edge = 2 * h + (lower ? 3 * w : 2 * w) + shelves * w;
  if (lower || tall) {
    board += w * 0.15;
    edge += w;
  }
  // Szuflada Merivobox: dno + plecy z płyty.
  board += drawers * (Math.max(w - 0.075, 0) * 0.47 + Math.max(w - 0.087, 0) * 0.14);
  edge += drawers * w;

  const fronts = c.kind === "upper_flap" ? 1 : c.kind === "lower_drawers" ? drawers : doors;
  // Słupek: drzwi jedne nad drugimi.
  const doorH = tall ? h / 2 : h;

  return {
    board_m2: board,
    hdf_m2: w * h,
    edge_mb: edge,
    front_m2: c.front_m2 ?? w * h,
    hinges: doors * hingesPerDoor(doorH),
    drawers,
    flaps: c.kind === "upper_flap" ? 1 : 0,
    legs: lower || tall ? (w > 0.9 ? 6 : 4) : 0,
    hung: hung ? 1 : 0,
    handles: fronts,
    worktop_mb: lower ? w : 0,
  };
}

export type CostParts = {
  board: number;
  cutting: number;
  edging: number;
  hdf: number;
  fronts: number;
  hardware: number;
  worktop: number;
  overhead: number;
};

export const COST_PART_LABELS: Record<keyof CostParts, string> = {
  board: "Płyta",
  cutting: "Cięcie",
  edging: "Oklejanie",
  hdf: "Plecy HDF",
  fronts: "Fronty",
  hardware: "Okucia",
  worktop: "Blat",
  overhead: "Drobne i transport",
};

export function costOfBom(b: Bom, r: Rates): CostParts {
  const boardM2 = b.board_m2 * (1 + r.board_extra_pct / 100);
  const p = {
    board: boardM2 * r.board_m2,
    cutting: boardM2 * r.cut_mb_per_m2 * r.cut_mb,
    edging: b.edge_mb * (1 + r.edge_extra_pct / 100) * r.edge_mb,
    hdf: b.hdf_m2 * r.hdf_m2,
    fronts: b.front_m2 * (1 + r.front_extra_pct / 100) * r.front_m2,
    hardware:
      b.hinges * r.hinge + b.drawers * r.drawer_set + b.flaps * r.flap_set + b.legs * r.leg + b.hung * r.hang_set + b.handles * r.handle,
    worktop: b.worktop_mb * r.worktop_mb,
    overhead: 0,
  };
  p.overhead = (sumParts(p) * r.overhead_pct) / 100;
  return p;
}

export const sumParts = (p: CostParts) =>
  p.board + p.cutting + p.edging + p.hdf + p.fronts + p.hardware + p.worktop + p.overhead;

export const priceOf = (cost: number, r: Rates) => cost * (1 + r.margin_pct / 100);

export type Estimate = {
  items: { cab: Cab; bom: Bom; cost: number; price: number }[];
  parts: CostParts;
  extrasCost: number;
  /** Koszt materiału brutto (szafki + dodatki). */
  cost: number;
  margin: number;
  /** Cena dla klienta brutto. */
  price: number;
};

/** Rodzaj frontów: zamawiane (lakier / fornir / akryl) albo cięte z płyty laminowanej. */
export type FrontType = "ordered" | "laminate";

export const FRONT_TYPE_LABELS: Record<FrontType, string> = {
  ordered: "Zamawiane (lakier, akryl)",
  laminate: "Z płyty laminowanej",
};

export const ratesFor = (r: Rates, fronts: FrontType): Rates =>
  fronts === "laminate" ? { ...r, front_m2: r.front_laminate_m2 } : r;

export function estimate(cabs: Cab[], extraQty: Record<string, number>, rates: Rates, fronts: FrontType = "ordered"): Estimate {
  const r = ratesFor(rates, fronts);
  const parts: CostParts = { board: 0, cutting: 0, edging: 0, hdf: 0, fronts: 0, hardware: 0, worktop: 0, overhead: 0 };
  const items = cabs
    .filter((c) => c.kind !== "skip")
    .map((cab) => {
      const bom = bomOf(cab);
      const p = costOfBom(bom, r);
      for (const k of Object.keys(parts) as (keyof CostParts)[]) parts[k] += p[k];
      const cost = sumParts(p);
      return { cab, bom, cost, price: priceOf(cost, r) };
    });
  const extrasCost = r.extras.reduce((s, e) => s + (Number(extraQty[e.key]) || 0) * e.price, 0);
  const cost = sumParts(parts) + extrasCost;
  const price = priceOf(cost, r);
  return { items, parts, extrasCost, cost, margin: price - cost, price };
}

// ── Szafki ze skanu ──────────────────────────────────────────────────────────

/** Wysokość nóżek / cokołu odejmowana od szafek stojących na podłodze (skan mierzy od podłogi). */
export const PLINTH_MM = 150;

type ScanObj = {
  id: string;
  category: string;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  elevation_mm?: number;
  auto_wall?: string;
};

export type ScanCab = {
  id: string;
  category: string;
  /** Rozstawiona w Skanerze („Auto") — reszta to meble wykryte w pomieszczeniu albo dodane ręcznie. */
  planned: boolean;
  defaultKind: CabKind;
  kind: CabKind;
  cab: Cab;
};

const CAB_CATEGORIES = ["storage", "sink", "stove", "dishwasher", "oven", "refrigerator"];

function defaultKind(o: ScanObj): CabKind {
  const elev = o.elevation_mm ?? 0;
  if (o.category === "sink") return "sink";
  if (o.category === "dishwasher") return "appliance_front";
  if (o.category === "stove") return "lower_drawers";
  if (o.category === "refrigerator" || o.category === "oven") return "tall";
  if (elev >= 300) return o.height_mm <= 500 ? "upper_flap" : "upper_doors";
  if (o.height_mm >= 1500) return "tall";
  return o.width_mm < 300 ? "lower_doors" : "lower_drawers";
}

/** Obiekty skanu → szafki do wyceny. `kinds` = wybory użytkownika (id obiektu → rodzaj). */
export function cabsFromScan(objects: ScanObj[], kinds: Record<string, CabKind> = {}): ScanCab[] {
  return objects
    .filter((o) => CAB_CATEGORIES.includes(o.category))
    .map((o) => {
      const planned = !!o.auto_wall;
      const dk = defaultKind(o);
      const kind = kinds[o.id] ?? (planned ? dk : "skip");
      const onFloor = (o.elevation_mm ?? 0) < 50;
      // Zlew dodany ręcznie w Skanerze to sama komora (200 mm nad blatem) — szafka pod nim ma wysokość dolnych.
      const h = o.category === "sink" && !onFloor ? 720 : onFloor ? Math.max(o.height_mm - PLINTH_MM, 300) : o.height_mm;
      const d = o.category === "sink" && !onFloor ? 560 : o.depth_mm;
      return { id: o.id, category: o.category, planned, defaultKind: dk, kind, cab: { kind, w: o.width_mm, h, d } };
    });
}

/** Zaokrąglenie ceny dla klienta do pełnych 100 zł. */
export const roundPrice = (v: number) => Math.round(v / 100) * 100;

// ── Wybory zapisane przy skanie (room_scans.estimate) ───────────────────────

export type ManualCab = { kind: CabKind; w: number };

export type ScanEstimateChoice = {
  /** id obiektu skanu → rodzaj szafki. */
  kinds: Record<string, CabKind>;
  /** klucz dodatku → ilość. */
  extras: Record<string, number>;
  /** Szafki dopisane ręcznie (rodzaj + szerokość). */
  manual: ManualCab[];
  fronts: FrontType;
};

export const EMPTY_CHOICE: ScanEstimateChoice = { kinds: {}, extras: {}, manual: [], fronts: "ordered" };

const KINDS = Object.keys(CAB_KIND_LABELS) as CabKind[];

export function parseChoice(v: unknown): ScanEstimateChoice {
  const o = (v && typeof v === "object" ? v : {}) as Partial<ScanEstimateChoice>;
  const kinds: Record<string, CabKind> = {};
  for (const [k, x] of Object.entries(o.kinds ?? {})) if (KINDS.includes(x as CabKind)) kinds[k] = x as CabKind;
  const extras: Record<string, number> = {};
  for (const [k, x] of Object.entries(o.extras ?? {})) if (Number(x) > 0) extras[k] = Number(x);
  const manual = (Array.isArray(o.manual) ? o.manual : [])
    .filter((m) => m && KINDS.includes(m.kind) && Number(m.w) > 0)
    .map((m) => ({ kind: m.kind, w: Math.round(Number(m.w)) }));
  return { kinds, extras, manual, fronts: o.fronts === "laminate" ? "laminate" : "ordered" };
}

/** Typowe wymiary korpusu dla szafki dopisanej ręcznie. */
export function manualCab(m: ManualCab): Cab {
  const dims: Record<CabKind, [number, number]> = {
    lower_doors: [720, 560],
    lower_drawers: [720, 560],
    sink: [720, 560],
    upper_doors: [720, 350],
    upper_flap: [360, 350],
    tall: [2100, 560],
    appliance_front: [720, 0],
    skip: [0, 0],
  };
  const [h, d] = dims[m.kind];
  return { kind: m.kind, w: m.w, h, d };
}
