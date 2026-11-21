// Model danych Projektanta kuchni. Jedna prawda: geometria pochodzi ze skanu (room_scans.data),
// a projekt trzyma tylko to, co użytkownik dołożył (szafki, wybory okuć) + ręczne korekty pomiaru.
// Układ współrzędnych jak w skanie: milimetry; x = wzdłuż ściany od jej początku (lewego narożnika),
// z = wysokość od podłogi.

import type { ScanMarkerKind } from "../dao/room_scans.types";
import type { FrontType } from "../cabinetPricing";

export type Layer = "low" | "up" | "both";

/** Przeszkoda na ścianie: prostokąt x0..x1 × z0..z1 + ile wystaje przed lico (mm). */
export type ObstacleKind =
  | "window"
  | "door"
  | "opening"
  | "sill"
  | "radiator"
  | "pipe"
  | "fuse_box"
  | "riser"
  | "beam"
  | "box";

export type Obstacle = {
  id: string;
  kind: ObstacleKind;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  depth_mm: number;
  /** Trzeba zostawić dostęp (skrzynka, zawór, rewizja) — zabudowa tylko z drzwiczkami / wyjmowanym frontem. */
  access?: boolean;
  label: string;
};

/** Punkt / obszar instalacji (woda, odpływ, gaz, prąd…). */
export type ServicePoint = {
  id: string;
  kind: ScanMarkerKind;
  x0: number;
  x1: number;
  z: number;
  note?: string;
};

export type WallSource = "dalmierz" | "lidar";

export type RoomWall = {
  id: string;
  index: number;
  label: string;
  /** Długość użyteczna: najmniejsza z pomiarów (dół / środek / góra) — tyle na pewno jest. */
  length_mm: number;
  /** Wysokość użyteczna: najmniejsza z pomiarów (lewo / środek / prawo) i skosu. */
  height_mm: number;
  source: WallSource;
  /** Rozrzut długości / wysokości z dalmierza (mm) — ściana „krzywa", gdy ≥ 5. */
  length_dev_mm: number;
  height_dev_mm: number;
  /** Kąt wewnętrzny w narożniku na początku ściany (90 = prosty); null = pierwsza ściana otwartego obrysu. */
  corner_start_deg: number | null;
  /** Ściana do wybudowania — nie projektować na niej jeszcze. */
  planned: boolean;
  obstacles: Obstacle[];
  points: ServicePoint[];
};

export type Room = {
  walls: RoomWall[];
  height_mm: number;
  closed: boolean;
};

/** Zmiana pomiaru wpisana ręcznie w projektancie — nadpisuje skan (priorytet jak dalmierz). */
export type WallOverride = { length_mm?: number; height_mm?: number };

export type AventosKind = "HK" | "HF" | "HL";
export type DrawerSystem = "merivobox" | "legrabox";

/** Szafka postawiona na ścianie. */
export type Placed = {
  uid: string;
  libId: string;
  wall: string;
  w: number;
  x: number;
  /** Zabudowa pod sufit: słupek / nadstawka dociągnięta do sufitu (z luzem). */
  to_ceiling?: boolean;
  /** Nadpisanie wysokości (np. słupek niższy pod skos). */
  h?: number;
  aventos?: AventosKind;
  drawer_system?: DrawerSystem;
};

export type KitchenProject = {
  version: 2;
  scan_id: string | null;
  fronts: FrontType;
  items: Placed[];
  overrides: Record<string, WallOverride>;
  /** Marża tej wyceny (null = z cennika). */
  margin_pct: number | null;
  /** Ściany dodane ręcznie, gdy nie ma skanu (id → długość). */
  manual_walls?: { id: string; length_mm: number; height_mm: number }[];
};

export type IssueLevel = "error" | "warn" | "info";

export type Issue = {
  level: IssueLevel;
  code: string;
  msg: string;
  uid?: string;
  wall?: string;
};

export type HardwareLine = {
  key: string;
  name: string;
  qty: number;
  /** Cena wchodzi już do wyceny przez pozycję cennika szafek — linia tylko do zamówienia. */
  priced_by: "cabinet_rates";
  note?: string;
};

export type KitchenQuoteSnapshot = {
  at: string;
  cabinets: number;
  cost: number;
  price: number;
  margin_pct: number;
  worktop_mb: number;
  plinth_mb: number;
  fronts: FrontType;
  hardware: HardwareLine[];
};
