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
   *  Domyślnie 100% (cena = 2 × materiał) — założenie Artura; przy skanie można ją przesunąć w górę / w dół.
   *  Dla porównania: Denis wyszedł na 70%, Turek na 106%. */
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
  /** Drzwi przesuwne w ramie alu — Laguna Multiomega Wide (rączki 8710, ramiak 8830, tory 8840 / 8209):
   *  na skrzydło (2 rączki 2,7 m + 2 wózki + 2 prowadniki + szczotki) i na metr szerokości szafy
   *  (ramiaki góra / dół + tor górny + dolny). Ceny Belmeb brutto z 11.2026 (promocyjne);
   *  2 skrzydła na 3 m = 2 × 160 + 3 × 163 ≈ 809 zł = cena gotowego kompletu. */
  slide_laguna_door: number;
  slide_laguna_mb: number;
  /** To samo dla GTV: rączka NOVA S, listwy górna / dolna, tor górny + dolny PRO z maskownicą.
   *  2 skrzydła na 3 m ≈ 560 zł. Skład kompletów wózków niepotwierdzony. */
  slide_gtv_door: number;
  slide_gtv_mb: number;
  /** Szafy: dodatek do płyty i do oklejania w %. Osobno od kuchni — w szafie model liczy każdy element
   *  (boki, przegrody, wieńce, półki, cokół), więc dodatek to tylko zapas na blendy i drobne formatki.
   *  Kuchenne 60% / 120% zawyżały szafę (uwaga Artura 2026-11-12, porównanie z wyceną Zimex). */
  wardrobe_board_extra_pct: number;
  /** Płyta na szafę, zł/m² — dekor (korpus i wypełnienie skrzydeł są na widoku), nie biała jak w korpusach kuchni.
   *  Zimex 11.2026: maryland oak R20410 343,17 zł / arkusz 2800×2100 = 58,4 zł/m². */
  wardrobe_board_m2: number;
  /** Szuflada skrzynkowa w szafie: prowadnice Blum Movento 500 mm z Blumotion (760H5000SU, komplet 149,92)
   *  + 2 sprzęgła T51.7601 (6,43) — Mercury brutto 06.2026. Skrzynka i czoło liczone z płyty. */
  wardrobe_drawer_runner: number;
  /** Oświetlenie LED 24 V w szafie: metr taśmy w profilu alu z kloszem (z przewodami),
   *  zasilacze wg mocy i włącznik / czujnik otwarcia. Ceny szacunkowe — do potwierdzenia fakturą. */
  led_m: number;
  led_psu_30: number;
  led_psu_60: number;
  led_psu_100: number;
  led_psu_150: number;
  led_switch: number;
  wardrobe_edge_extra_pct: number;
  /** Drążek z uchwytami, zł/mb — szacunek, brak faktury. */
  rail_mb: number;
  /** Pantograf, zł/szt — szacunek, brak faktury. */
  pantograph: number;
  /** Drobne: wkręty, kleje, pakowanie, transport, paliwo — % od kosztu materiału. */
  overhead_pct: number;
  extras: Extra[];
};

export const DEFAULT_RATES: Rates = {
  margin_pct: 100,
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
  slide_laguna_door: 160,
  slide_laguna_mb: 163,
  slide_gtv_door: 125,
  slide_gtv_mb: 104,
  wardrobe_board_extra_pct: 15,
  wardrobe_board_m2: 58,
  wardrobe_drawer_runner: 165,
  led_m: 45,
  led_psu_30: 59,
  led_psu_60: 89,
  led_psu_100: 129,
  led_psu_150: 159,
  led_switch: 40,
  wardrobe_edge_extra_pct: 25,
  rail_mb: 25,
  pantograph: 400,
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
    { key: "slide_soft_close", name: "Domyk drzwi przesuwnych (na skrzydło)", unit: "szt", price: 55 },
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
  /** Szafy ze skanu: koszt, cena i same okucia drzwi przesuwnych (0 przy uchylnych). */
  wardrobes: { id: string; cost: number; price: number; slide: number }[];
  /** Marża użyta w tej wycenie. */
  margin_pct: number;
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

/** System drzwi przesuwnych szafy. */
export type SlideSystem = "laguna" | "gtv";

export const SLIDE_SYSTEM_LABELS: Record<SlideSystem, string> = {
  laguna: "Laguna Multiomega Wide",
  gtv: "GTV Nova S + tory GTV",
};

/** Moce taśm LED 24 V do wyboru w szkicu szafy, W/m. */
export const LED_POWERS = [4.8, 9.6, 14.4];
/** Typowe zasilacze 24 V, W. */
export const LED_PSU_SIZES = [30, 60, 100, 150] as const;

export type LedPlan = { meters: number; wm: number; watts: number; psuW: number; psuCount: number };

/** Dobór zasilacza: moc taśmy (długość × W/m) + 20% zapasu → najmniejszy typowy zasilacz;
 *  ponad 150 W dzielimy na kilka zasilaczy 150 W. Brak taśmy = null. */
export function ledPlan(lengthMm: number | undefined, wm: number | undefined): LedPlan | null {
  if (!lengthMm || lengthMm < 100) return null;
  const meters = lengthMm / 1000;
  const power = wm && wm > 0 ? wm : 9.6;
  const watts = meters * power;
  const need = watts * 1.2;
  const fit = LED_PSU_SIZES.find((s) => s >= need);
  return fit
    ? { meters, wm: power, watts, psuW: fit, psuCount: 1 }
    : { meters, wm: power, watts, psuW: 150, psuCount: Math.ceil(need / 150) };
}

export const ledCost = (r: Rates, p: LedPlan | null) =>
  p ? p.meters * r.led_m + p.psuCount * r[`led_psu_${p.psuW}` as "led_psu_30"] + r.led_switch : 0;

export const ledLabel = (p: LedPlan) =>
  `LED ${p.meters.toFixed(1).replace(".", ",")} m · ${String(p.wm).replace(".", ",")} W/m = ${Math.round(p.watts)} W · zasilacz 24 V ${
    p.psuCount > 1 ? `${p.psuCount} × ` : ""
  }${p.psuW} W`;

/** Okucia drzwi przesuwnych (rączki, ramiaki, tory, wózki) — bez wypełnienia skrzydeł. */
export const slideHardware = (r: Rates, system: SlideSystem, doors: number, widthMm: number) =>
  system === "gtv"
    ? doors * r.slide_gtv_door + (widthMm / 1000) * r.slide_gtv_mb
    : doors * r.slide_laguna_door + (widthMm / 1000) * r.slide_laguna_mb;

/** Szkic szafy ze Skanera (ScanWardrobe) — tylko pola potrzebne do wyceny. */
export type WardrobeLike = {
  id: string;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  plinth_mm: number;
  top_mm: number;
  doors: "sliding" | "hinged" | "none";
  door_count: number;
  construction?: "box_back" | "box" | "frame" | "modular";
  pawlacz_mm?: number;
  pawlacz_doors?: number;
  led_mm?: number;
  led_wm?: number;
  sections: { width_mm?: number; zones: { kind: string; height_mm?: number; count?: number }[] }[];
};

/** Koszt materiału szafy: korpus z sekcji i stref, plecy, drzwi (przesuwne w ramie alu albo uchylne), okucia. */
export function wardrobeCost(wd: WardrobeLike, r: Rates, slide: SlideSystem): CostParts {
  const W = wd.width_mm / 1000, D = wd.depth_mm / 1000;
  const H = Math.max(wd.height_mm - (wd.plinth_mm || 0) - (wd.top_mm || 0), 300) / 1000;
  const sliding = wd.doors === "sliding";
  // Drzwi przesuwne zabierają ok. 100 mm głębokości wnętrza.
  const d = Math.max(D - (sliding ? 0.1 : 0), 0.2);
  const n = Math.max(wd.sections.length, 1);
  const fixed = wd.sections.reduce((s, x) => s + (x.width_mm ?? 0), 0) / 1000;
  const free = wd.sections.filter((x) => !x.width_mm).length;
  const frame = wd.construction === "frame";
  const paw = wd.pawlacz_mm && wd.pawlacz_mm > 50 ? wd.pawlacz_mm / 1000 : 0;

  // Segmentowa: każdy segment to osobny, gotowy korpus z plecami (2 boki + góra + dno), skręcany z sąsiednim;
  // pawlacz to osobne nadstawki — kolejna góra i dno na każdym segmencie.
  const modular = wd.construction === "modular";
  const tops = paw ? 4 : 2;
  // Wnętrze (wspólne dla szkieletu i skrzynkowej): przegrody, cokół, półka pawlacza, półki, szuflady.
  let board = (modular ? 0 : (n - 1) * H * d + (paw ? W * d : 0)) + W * 0.1;
  let edge = modular ? 0 : (n - 1) * H + (paw ? W : 0);
  // Skrzynia: skrzynkowa = 2 boki + wieniec górny i dolny; segmentowa = to samo na każdy segment
  // (+ góra i dno nadstawek). Duże formatki liczone niemal dokładnie.
  const boxBoard = frame ? 0 : modular ? 2 * n * H * d + tops * W * d : 2 * H * d + 2 * W * d;
  const boxEdge = frame ? 0 : modular ? 2 * n * H + tops * W : 2 * H + 2 * W;
  let drawers = 0, frontM2 = 0, hardware = 0, handles = 0;
  for (const sec of wd.sections) {
    const sw = sec.width_mm ? sec.width_mm / 1000 : Math.max(W - fixed, 0) / Math.max(free, 1);
    for (const z of sec.zones) {
      const shelves =
        z.kind === "shelves" ? (z.count ?? 4) : z.kind === "shoes" ? (z.count ?? 3) : z.kind === "rail" || z.kind === "pantograph" ? 1 : 0;
      board += shelves * sw * d;
      edge += shelves * sw;
      if (z.kind === "rail") hardware += sw * r.rail_mb;
      if (z.kind === "pantograph") hardware += r.pantograph;
      if (z.kind === "drawers") {
        const c = z.count ?? 3;
        drawers += c;
        // Skrzynka: dno + przód i tył + 2 boki (wys. 140, gł. 500).
        board += c * (Math.max(sw - 0.075, 0) * 0.47 + 2 * Math.max(sw - 0.087, 0) * 0.14 + 2 * 0.5 * 0.14);
        edge += c * sw;
        // Czoła szuflad w szafie — z płyty, także za drzwiami przesuwnymi.
        frontM2 += sw * (z.height_mm ? z.height_mm / 1000 : c * 0.2);
        handles += c;
      }
    }
  }
  hardware += drawers * r.wardrobe_drawer_runner;
  hardware += ledCost(r, ledPlan(wd.led_mm, wd.led_wm));

  const doorN = Math.max(wd.door_count, 0);
  const doorH = H - paw;
  let frontsCost = frontM2 * r.front_laminate_m2;
  if (sliding) {
    // Skrzydła na pełną wysokość; wypełnienie z płyty 18 mm (materiał + cięcie, bez oklejania — siedzi w ramie).
    hardware += slideHardware(r, slide, doorN, wd.width_mm);
    frontsCost += W * H * 1.2 * (r.wardrobe_board_m2 + r.cut_mb_per_m2 * r.cut_mb);
  } else if (wd.doors === "hinged") {
    frontsCost += W * doorH * (1 + r.front_extra_pct / 100) * r.front_m2;
    hardware += doorN * hingesPerDoor(doorH) * r.hinge;
    handles += doorN;
    if (paw) {
      const pd = wd.pawlacz_doors ?? Math.max(doorN, 2);
      frontsCost += W * paw * r.front_m2;
      hardware += pd * 2 * r.hinge;
      handles += pd;
    }
  }
  hardware += handles * r.handle;

  // Wnętrze na zapasach kuchennych — cena szkieletu zgadzała się Arturowi z wyceną Zimex (2026-11-12).
  // Skrzynkowa = szkielet + skrzynia z małym zapasem „szafowym" (+ plecy HDF); kuchenne zapasy
  // na bokach i wieńcach zawyżały cenę.
  const boardM2 = board * (1 + r.board_extra_pct / 100) + boxBoard * (1 + r.wardrobe_board_extra_pct / 100);
  const p: CostParts = {
    board: boardM2 * r.wardrobe_board_m2,
    cutting: boardM2 * r.cut_mb_per_m2 * r.cut_mb,
    edging: (edge * (1 + r.edge_extra_pct / 100) + boxEdge * (1 + r.wardrobe_edge_extra_pct / 100)) * r.edge_mb,
    hdf: wd.construction === "box" || frame ? 0 : W * H * r.hdf_m2,
    fronts: frontsCost,
    hardware,
    worktop: 0,
    overhead: 0,
  };
  p.overhead = (sumParts(p) * r.overhead_pct) / 100;
  return p;
}

export type EstimateOptions = {
  fronts?: FrontType;
  wardrobes?: WardrobeLike[];
  slide?: SlideSystem;
  /** Marża dla tej wyceny zamiast tej z cennika. */
  margin_pct?: number;
};

export function estimate(cabs: Cab[], extraQty: Record<string, number>, rates: Rates, opts: EstimateOptions = {}): Estimate {
  const base = ratesFor(rates, opts.fronts ?? "ordered");
  const r = opts.margin_pct != null ? { ...base, margin_pct: opts.margin_pct } : base;
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
  const slide = opts.slide ?? "laguna";
  const wardrobes = (opts.wardrobes ?? []).map((wd) => {
    const p = wardrobeCost(wd, r, slide);
    for (const k of Object.keys(parts) as (keyof CostParts)[]) parts[k] += p[k];
    const cost = sumParts(p);
    return {
      id: wd.id,
      cost,
      price: priceOf(cost, r),
      slide: wd.doors === "sliding" ? slideHardware(r, slide, Math.max(wd.door_count, 0), wd.width_mm) : 0,
    };
  });
  const extrasCost = r.extras.reduce((s, e) => s + (Number(extraQty[e.key]) || 0) * e.price, 0);
  const cost = sumParts(parts) + extrasCost;
  const price = priceOf(cost, r);
  return { items, wardrobes, parts, extrasCost, cost, margin: price - cost, margin_pct: r.margin_pct, price };
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
  slide: SlideSystem;
  /** Marża tylko dla tej wyceny (brak = z cennika). */
  margin_pct?: number;
};

export const EMPTY_CHOICE: ScanEstimateChoice = { kinds: {}, extras: {}, manual: [], fronts: "ordered", slide: "laguna" };

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
  const m = Number(o.margin_pct);
  return {
    kinds,
    extras,
    manual,
    fronts: o.fronts === "laminate" ? "laminate" : "ordered",
    slide: o.slide === "gtv" ? "gtv" : "laguna",
    ...(o.margin_pct != null && Number.isFinite(m) && m >= 0 ? { margin_pct: Math.round(m) } : {}),
  };
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
