// Format skanu wysyłany przez aplikację iPad "LUVIANO Skaner" (RoomPlan).
// Rzut 2D z góry: oś x w prawo, oś y w głąb pomieszczenia; wszystkie
// współrzędne i wymiary w milimetrach. Wysokości liczone od podłogi.

export type ScanWall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length_mm: number;
  height_mm: number;
  /** Wymiar potwierdzony ręcznie / dalmierzem na iPadzie. */
  measured?: boolean;
};

export type ScanOpeningKind = "door" | "window" | "opening";

export type ScanOpening = {
  id: string;
  kind: ScanOpeningKind;
  wall_id: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width_mm: number;
  height_mm: number;
  /** Wysokość dolnej krawędzi od podłogi (parapet dla okna, 0 dla drzwi). */
  sill_mm: number;
};

export type ScanObject = {
  id: string;
  /** Kategoria RoomPlan: refrigerator, stove, oven, dishwasher, sink, storage, washerDryer, ... */
  category: string;
  cx: number;
  cy: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  /** Dolna krawędź od podłogi (szafki wiszące > 0); brak w starszych skanach. */
  elevation_mm?: number;
  rotation_deg: number;
};

export type ScanData = {
  version: 1;
  scanned_at: string;
  walls: ScanWall[];
  openings: ScanOpening[];
  objects: ScanObject[];
  /** Wysokość pomieszczenia (najwyższa ściana), mm. */
  room_height_mm?: number;
  /** Ściany tworzą zamknięty obrys (kolejność = obieg pomieszczenia). */
  closed?: boolean;
};

export type RoomScan = {
  id: string;
  user_id: string;
  job_id: string;
  name: string;
  data: ScanData;
  created_at: string;
};

export const SCAN_OBJECT_LABELS: Record<string, string> = {
  refrigerator: "Lodówka",
  stove: "Kuchenka",
  oven: "Piekarnik",
  dishwasher: "Zmywarka",
  sink: "Zlew",
  storage: "Szafka",
  washerDryer: "Pralka",
  table: "Stół",
  chair: "Krzesło",
  sofa: "Sofa",
  bed: "Łóżko",
  toilet: "WC",
  bathtub: "Wanna",
  fireplace: "Kominek",
  television: "TV",
  stairs: "Schody",
};

export const SCAN_OPENING_LABELS: Record<ScanOpeningKind, string> = {
  door: "Drzwi",
  window: "Okno",
  opening: "Otwór",
};
