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
  /** Skos dachu nad ścianą (poddasze). */
  slope?: ScanWallSlope;
};

/** Skos: kolanko przy ścianie, sufit wznosi się do pełnej wysokości (zasięg w poziomie albo kąt). */
export type ScanWallSlope = {
  knee_mm: number;
  depth_mm?: number;
  angle_deg?: number;
  /** Wykryty ze skanu RoomPlan. */
  detected?: boolean;
};

export type ScanWallCurve = {
  length_bottom?: number;
  length_middle?: number;
  length_top?: number;
  height_left?: number;
  height_middle?: number;
  height_right?: number;
};

export type WardrobeZoneKind = "shelves" | "rail" | "drawers" | "shoes" | "pantograph" | "empty";

export type ScanWardrobe = {
  id: string;
  wall_id: string;
  /** Lewy bok od lewego narożnika ściany. */
  offset_mm: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  plinth_mm: number;
  top_mm: number;
  doors: "sliding" | "hinged" | "none";
  door_count: number;
  /** Sekcje od lewej; strefy od dołu. Szerokość / wysokość brak = równy podział reszty. */
  /** box_back = skrzynkowa z plecami (domyślnie), box = bez pleców, frame = sam szkielet (wnęka). */
  construction?: "box_back" | "box" | "frame";
  /** Pawlacz na całą szerokość nad sekcjami (wysokość w świetle) i liczba jego drzwiczek. */
  pawlacz_mm?: number;
  pawlacz_doors?: number;
  /** Płyta korpusu / frontów z wzornika Pfleiderer (fronty brak = jak korpus). */
  body_decor?: { code: string; name: string };
  front_decor?: { code: string; name: string };
  /** Kolory okuć: uchwyty / profile drzwi, tor górny i dolny (przesuwne). */
  handle_color?: string;
  track_top_color?: string;
  track_bottom_color?: string;
  sections: { width_mm?: number; zones: { kind: WardrobeZoneKind; height_mm?: number; count?: number }[] }[];
  note?: string;
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
  /** Parapet wewnętrzny: wysunięcie przed lico ściany i grubość deski (mm). */
  sill_depth_mm?: number;
  sill_thickness_mm?: number;
};

/** Element na ścianie (grzejnik, rura, skrzynka…) — FeatureKind w WallFeatures.swift. */
export type ScanFeatureKind = "radiator" | "pipe_v" | "pipe_h" | "fuse_box" | "riser" | "beam" | "box";

export type ScanFeature = {
  id: string;
  kind: ScanFeatureKind;
  wall_id: string;
  /** Lewa krawędź od lewego narożnika ściany. */
  offset_mm: number;
  /** Dolna krawędź od podłogi. */
  elevation_mm: number;
  width_mm: number;
  height_mm: number;
  /** Ile wystaje przed ścianę; 0 = w licu. */
  depth_mm: number;
  /** Zabudowa musi zostawić dostęp (drzwiczki / otwierany front). */
  access?: boolean;
  note?: string;
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
  /** Elementy na ścianach (grzejnik, rury, skrzynka…). */
  features?: ScanFeature[];
  /** Szkice szaf przy ścianach (Wardrobe.swift). */
  wardrobes?: ScanWardrobe[];
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
