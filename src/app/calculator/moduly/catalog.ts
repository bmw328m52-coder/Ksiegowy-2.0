// Katalog modułów i materiałów do kalkulatora wyceny kuchni — MVP.
// Liczby są poglądowe; Artur podstawi swoje ceny zakupu z faktur.
// BOM (bill of materials) opisuje co wchodzi w pojedynczy moduł.

export type ModuleCategory = "dolne" | "gorne" | "slupki" | "narozniki";

export type ModuleBom = {
  /** m² płyty 18mm (korpus: boki, dno, wieniec, półki) */
  plyta_m2: number;
  /** m² HDF 3mm (plecy) */
  hdf_m2: number;
  /** mb okleiny 2mm (krawędzie widoczne, fronty) */
  okleina_2mm_mb: number;
  /** mb okleiny 0.4mm (krawędzie niewidoczne) */
  okleina_04mm_mb: number;
  /** m² fronta */
  fronty_m2: number;
  /** szt zawiasów Blum (lub odpowiednik) */
  zawiasy: number;
  /** par prowadnic (komplet do szuflady) */
  prowadnice: number;
  /** szt nóg regulowanych */
  nogi: number;
  /** szt uchwytów */
  uchwyty: number;
};

export type ModuleDef = {
  code: string;
  name: string;
  category: ModuleCategory;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  bom: ModuleBom;
  /** szacowane minuty robocizny (cięcie, oklejanie, montaż korpusu) */
  labor_min: number;
};

export const MODULES: ModuleDef[] = [
  {
    code: "D40",
    name: "Dolna 40 drzwi",
    category: "dolne",
    width_mm: 400,
    height_mm: 720,
    depth_mm: 580,
    bom: {
      plyta_m2: 1.45,
      hdf_m2: 0.29,
      okleina_2mm_mb: 3.2,
      okleina_04mm_mb: 4.8,
      fronty_m2: 0.29,
      zawiasy: 2,
      prowadnice: 0,
      nogi: 4,
      uchwyty: 1,
    },
    labor_min: 45,
  },
  {
    code: "D60",
    name: "Dolna 60 drzwi",
    category: "dolne",
    width_mm: 600,
    height_mm: 720,
    depth_mm: 580,
    bom: {
      plyta_m2: 1.87,
      hdf_m2: 0.43,
      okleina_2mm_mb: 4.0,
      okleina_04mm_mb: 5.5,
      fronty_m2: 0.43,
      zawiasy: 4,
      prowadnice: 0,
      nogi: 4,
      uchwyty: 2,
    },
    labor_min: 55,
  },
  {
    code: "D60-S3",
    name: "Dolna 60 szuflady ×3",
    category: "dolne",
    width_mm: 600,
    height_mm: 720,
    depth_mm: 580,
    bom: {
      plyta_m2: 1.55,
      hdf_m2: 0.43,
      okleina_2mm_mb: 6.2,
      okleina_04mm_mb: 4.0,
      fronty_m2: 0.43,
      zawiasy: 0,
      prowadnice: 3,
      nogi: 4,
      uchwyty: 3,
    },
    labor_min: 90,
  },
  {
    code: "D80-Z",
    name: "Dolna 80 zlewozmywakowa",
    category: "dolne",
    width_mm: 800,
    height_mm: 720,
    depth_mm: 580,
    bom: {
      plyta_m2: 1.95,
      hdf_m2: 0.58,
      okleina_2mm_mb: 4.6,
      okleina_04mm_mb: 5.8,
      fronty_m2: 0.58,
      zawiasy: 4,
      prowadnice: 0,
      nogi: 4,
      uchwyty: 2,
    },
    labor_min: 60,
  },
  {
    code: "G60",
    name: "Górna 60 drzwi",
    category: "gorne",
    width_mm: 600,
    height_mm: 720,
    depth_mm: 320,
    bom: {
      plyta_m2: 1.15,
      hdf_m2: 0.43,
      okleina_2mm_mb: 3.5,
      okleina_04mm_mb: 4.0,
      fronty_m2: 0.43,
      zawiasy: 4,
      prowadnice: 0,
      nogi: 0,
      uchwyty: 2,
    },
    labor_min: 40,
  },
  {
    code: "G80",
    name: "Górna 80 drzwi",
    category: "gorne",
    width_mm: 800,
    height_mm: 720,
    depth_mm: 320,
    bom: {
      plyta_m2: 1.40,
      hdf_m2: 0.58,
      okleina_2mm_mb: 4.0,
      okleina_04mm_mb: 4.5,
      fronty_m2: 0.58,
      zawiasy: 4,
      prowadnice: 0,
      nogi: 0,
      uchwyty: 2,
    },
    labor_min: 45,
  },
  {
    code: "S60-P",
    name: "Słupek 60 piekarnik H230",
    category: "slupki",
    width_mm: 600,
    height_mm: 2300,
    depth_mm: 580,
    bom: {
      plyta_m2: 4.85,
      hdf_m2: 1.38,
      okleina_2mm_mb: 11.5,
      okleina_04mm_mb: 8.0,
      fronty_m2: 1.20,
      zawiasy: 6,
      prowadnice: 1,
      nogi: 4,
      uchwyty: 4,
    },
    labor_min: 140,
  },
  {
    code: "N90",
    name: "Narożna L 90×90",
    category: "narozniki",
    width_mm: 900,
    height_mm: 720,
    depth_mm: 900,
    bom: {
      plyta_m2: 2.85,
      hdf_m2: 0.85,
      okleina_2mm_mb: 5.0,
      okleina_04mm_mb: 7.0,
      fronty_m2: 0.55,
      zawiasy: 4,
      prowadnice: 0,
      nogi: 4,
      uchwyty: 1,
    },
    labor_min: 95,
  },
];

// ─────────────────────────────────────────────────────────────
// Materiały (ceny zakupu netto — Artur podstawi swoje)
// ─────────────────────────────────────────────────────────────

export type BoardOption = {
  id: string;
  name: string;
  /** PLN / m² netto */
  price_m2: number;
};

export const BOARDS: BoardOption[] = [
  { id: "lam-bialy", name: "Laminat 18mm — biały", price_m2: 38 },
  { id: "lam-dab", name: "Laminat 18mm — dąb sonoma", price_m2: 52 },
  { id: "lam-grafit", name: "Laminat 18mm — grafit struktura", price_m2: 64 },
  { id: "lam-premium", name: "Laminat 18mm — dekor premium", price_m2: 95 },
];

export type FrontOption = {
  id: string;
  name: string;
  /** PLN / m² netto (gotowy front z obróbką) */
  price_m2: number;
};

export const FRONTS: FrontOption[] = [
  { id: "lam-front", name: "Laminat 18mm (front z płyty)", price_m2: 95 },
  { id: "folia", name: "MDF foliowany mat", price_m2: 280 },
  { id: "lakier-mat", name: "MDF lakier mat", price_m2: 520 },
  { id: "lakier-polysk", name: "MDF lakier połysk", price_m2: 580 },
  { id: "fornir-dab", name: "Fornir naturalny — dąb", price_m2: 720 },
];

export type BlatOption = {
  id: string;
  name: string;
  /** PLN / mb netto (głębokość 60cm) */
  price_mb: number;
};

export const BLATY: BlatOption[] = [
  { id: "lam-38", name: "Blat laminowany 38mm", price_mb: 180 },
  { id: "lam-grube", name: "Blat laminowany 60mm (gruby)", price_mb: 320 },
  { id: "konglomerat", name: "Konglomerat (kwarc)", price_mb: 950 },
  { id: "spiek", name: "Spiek kwarcowy", price_mb: 1450 },
];

export type HandleOption = {
  id: string;
  name: string;
  /** PLN / szt netto */
  price_szt: number;
};

export const UCHWYTY: HandleOption[] = [
  { id: "frez", name: "Frezowanie (bez uchwytu)", price_szt: 0 },
  { id: "prof-c", name: "Profil C aluminium", price_szt: 18 },
  { id: "klasyk", name: "Klasyczny aluminium 128mm", price_szt: 12 },
  { id: "design", name: "Designerski stal szczotkowana", price_szt: 45 },
];

// Akcesoria i drobnica — ceny stałe (Artur podstawi swoje)
export const PRICES = {
  /** PLN / m² płyty HDF 3mm (plecy) netto */
  hdf_m2: 22,
  /** PLN / mb okleiny 2mm netto */
  okleina_2mm_mb: 3.5,
  /** PLN / mb okleiny 0.4mm netto */
  okleina_04mm_mb: 0.8,
  /** PLN / szt zawias Blum z prowadzeniem */
  zawias_szt: 28,
  /** PLN / komplet prowadnice Tandembox */
  prowadnica_komplet: 165,
  /** PLN / szt noga regulowana */
  noga_szt: 6,
};
