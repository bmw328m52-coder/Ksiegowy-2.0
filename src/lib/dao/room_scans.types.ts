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
  /** Ściana do wybudowania (dorysowana na pomiarze, jeszcze jej nie ma). */
  planned?: boolean;
  /** Krzywizny z dalmierza: długość dół/środek/góra, wysokość lewo/środek/prawo (mm). */
  curve?: ScanWallCurve;
};

export type ScanWallCurve = {
  length_bottom?: number;
  length_middle?: number;
  length_top?: number;
  height_left?: number;
  height_middle?: number;
  height_right?: number;
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
  /** Odcinki zmierzone dalmierzem na iPadzie: before, after, width, sill, height, head. */
  measured_parts?: string[];
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
  /** Szafka rozstawiona automatycznie przy ścianie (id). */
  auto_wall?: string;
};

/** Rodzaje punktów instalacji — zgodne z MarkerKind w ios/LuvianoSkaner/Sources/Markers.swift. */
export type ScanMarkerKind =
  | "water_cold"
  | "water_hot"
  | "drain"
  | "socket"
  | "power_400"
  | "gas"
  | "vent"
  | "light"
  | "switch"
  | "other";

/** Punkt instalacji wskazany ręcznie na ścianie. */
export type ScanMarker = {
  id: string;
  kind: ScanMarkerKind;
  wall_id: string;
  /** Odległość od początku ściany (x1,y1) — „od lewego narożnika" w widoku ściany. */
  offset_mm: number;
  /** Wysokość środka punktu od podłogi. */
  height_mm: number;
  note?: string;
  /** Id zdjęć — bucket `scan-photos`, ścieżka `{user_id}/{id}.jpg` (scanPhotoPath). */
  photos?: string[];
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
  /** Obrys podłogi wyliczony przez RoomPlan [x, y] (mm) — także gdy ściany się nie domykają. */
  floor?: [number, number][];
  /** Punkty instalacji (woda, odpływ, gniazdka…); brak w starszych skanach. */
  markers?: ScanMarker[];
  /** Lista kontrolna: potwierdzone ręcznie pozycje ("room_height", "none:gas"…). */
  checks?: string[];
  /** Notatki z pomiaru (całe pomieszczenie) wpisane na iPadzie. */
  notes?: string;
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

export const SCAN_PHOTOS_BUCKET = "scan-photos";
export const scanPhotoPath = (userId: string, photoId: string) => `${userId}/${photoId}.jpg`;
