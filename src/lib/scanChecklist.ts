// Lista kontrolna pomiaru ze skanu — ta sama logika co MeasureCheck w
// ios/LuvianoSkaner/Sources/Checklist.swift. Zmiana reguł = zmiana w obu miejscach.
import type { ScanData } from "@/lib/dao/room_scans.types";
import { SCAN_MARKER_KINDS, wallLetter } from "@/lib/scan2d";

export type CheckItem = { id: string; group: string; title: string; detail: string; ok: boolean };

type RoomType = NonNullable<ScanData["room_type"]>;

/** Instalacje, o które pytamy przy danym rodzaju pomiaru (RoomType.installations). */
const INSTALLATIONS: Record<RoomType, (keyof typeof SCAN_MARKER_KINDS)[]> = {
  kitchen: ["water_cold", "water_hot", "drain", "socket", "power_400", "gas", "vent"],
  wardrobe: ["socket"],
  bathroom: ["water_cold", "water_hot", "drain", "socket", "vent"],
  other: ["socket"],
};

/** Rodzaj pomiaru: zapisany w skanie, a dla starszych skanów zgadywany z nazwy (RoomType.guess). */
export function scanRoomType(scan: ScanData, ...texts: string[]): RoomType {
  if (scan.room_type) return scan.room_type;
  const t = texts.join(" ").toLowerCase();
  if (/szaf|garderob|przedpok|sypial/.test(t)) return "wardrobe";
  if (/łazien|lazien/.test(t)) return "bathroom";
  return "kitchen";
}

const OPENING_NAMES: Record<string, string> = { door: "Drzwi", window: "Okno", opening: "Przejście" };

export function scanChecklist(scan: ScanData, name = ""): CheckItem[] {
  const out: CheckItem[] = [];
  const type = scanRoomType(scan, name);
  const checks = new Set(scan.checks ?? []);
  const walls = scan.walls.filter((w) => !w.planned);
  const letter = (id: string) => wallLetter(scan.walls.findIndex((w) => w.id === id));

  for (const w of walls) {
    out.push({
      id: `wall${w.id}`,
      group: "Wymiary",
      title: `Ściana ${letter(w.id)}`,
      detail: w.measured
        ? `${Math.round(w.length_mm)} mm · zmierzona`
        : `${Math.round(w.length_mm)} mm ze skanu — potwierdź dalmierzem`,
      ok: w.measured === true,
    });
  }
  const height = scan.room_height_mm ?? Math.max(2500, ...scan.walls.map((w) => w.height_mm));
  out.push({
    id: "height",
    group: "Wymiary",
    title: "Wysokość pomieszczenia",
    detail: checks.has("room_height") ? `${Math.round(height)} mm · zmierzona` : "ze skanu — zmierz do sufitu",
    ok: checks.has("room_height"),
  });

  for (const w of walls) {
    for (const o of scan.openings.filter((x) => x.wall_id === w.id)) {
      const parts = new Set(o.measured_parts ?? []);
      const need: [string, string][] = [
        ["before", "od narożnika"],
        ["width", "szerokość"],
      ];
      if (o.kind === "window") need.push(["sill", "parapet"]);
      if (o.sill_mm + o.height_mm < w.height_mm - 1) need.push(["height", "wysokość"]);
      const missing = need.filter(([p]) => !parts.has(p));
      out.push({
        id: `op${o.id}`,
        group: "Otwory",
        title: `${OPENING_NAMES[o.kind] ?? "Otwór"} · ściana ${letter(w.id)}`,
        detail: missing.length
          ? `brak: ${missing.map(([, l]) => l).join(", ")}`
          : `${Math.round(o.width_mm)} × ${Math.round(o.height_mm)} · zmierzone`,
        ok: missing.length === 0,
      });
    }
  }

  if (type === "wardrobe") {
    const n = (scan.wardrobes ?? []).length;
    out.push({
      id: "wardrobe",
      group: "Szafa",
      title: "Szkic szafy",
      detail: n > 0 ? (n === 1 ? "1 szafa" : `${n} ${n < 5 ? "szafy" : "szaf"}`) : "brak szkicu szafy",
      ok: n > 0,
    });
  }

  const markers = scan.markers ?? [];
  for (const k of INSTALLATIONS[type]) {
    const n = markers.filter((m) => m.kind === k).length;
    const none = checks.has(`none:${k}`);
    out.push({
      id: `inst${k}`,
      group: "Instalacje",
      title: SCAN_MARKER_KINDS[k].label,
      detail: n > 0 ? (n === 1 ? "1 punkt" : `${n} punkty`) : none ? "nie ma" : "nie zaznaczono",
      ok: n > 0 || none,
    });
  }

  if (markers.length > 0) {
    const bare = markers.filter((m) => !(m.photos ?? []).length).length;
    out.push({
      id: "photos",
      group: "Zdjęcia",
      title: "Zdjęcia punktów instalacji",
      detail: bare === 0 ? "wszystkie mają zdjęcie" : `bez zdjęcia: ${bare} z ${markers.length}`,
      ok: bare === 0,
    });
  }
  return out;
}
