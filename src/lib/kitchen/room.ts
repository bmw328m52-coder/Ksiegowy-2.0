// Skan (room_scans.data) → Room: ściany w układzie lokalnym (x wzdłuż ściany), przeszkody i punkty instalacji.
// Zasada LUVIANO: wymiary z dalmierza (measured / curve) mają pierwszeństwo przed LiDAR-em (±2–5 cm),
// a dla ściany krzywej bierzemy NAJMNIEJSZY pomiar — szafka, która mieści się w najwęższym miejscu, mieści się wszędzie.

import type { ScanData, ScanWall } from "../dao/room_scans.types";
import { SCAN_OPENING_LABELS } from "../dao/room_scans.types";
import { openingSpans, wallAxis } from "../scan2d";
import type { Obstacle, ObstacleKind, Room, RoomWall, ServicePoint, WallOverride } from "./types";

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const spread = (vs: number[]) => (vs.length > 1 ? Math.max(...vs) - Math.min(...vs) : 0);
export const wallLabel = (i: number) => String.fromCharCode(65 + (i % 26));

const FEATURE_LABELS: Record<string, string> = {
  radiator: "Grzejnik",
  pipe_v: "Rura pionowa",
  pipe_h: "Rura pozioma",
  fuse_box: "Skrzynka bezpieczników",
  riser: "Pion",
  beam: "Belka / podciąg",
  box: "Obudowa",
};
const FEATURE_TO_OBSTACLE: Record<string, ObstacleKind> = {
  radiator: "radiator",
  pipe_v: "pipe",
  pipe_h: "pipe",
  fuse_box: "fuse_box",
  riser: "riser",
  beam: "beam",
  box: "box",
};

/** Kąt wewnętrzny w narożniku między ścianą poprzednią a bieżącą (stopnie). 270° = narożnik wklęsły (wnęka). */
function cornerAngle(prev: ScanWall, cur: ScanWall, orientation: number): number {
  const a = wallAxis(prev);
  const b = wallAxis(cur);
  // wektory wychodzące z narożnika: wstecz po poprzedniej i naprzód po bieżącej
  const vx = -a.ux, vy = -a.uy;
  const dot = Math.max(-1, Math.min(1, vx * b.ux + vy * b.uy));
  const ang = (Math.acos(dot) * 180) / Math.PI;
  const turn = a.ux * b.uy - a.uy * b.ux; // znak skrętu
  // skręt zgodny z obiegiem obrysu = narożnik wypukły (kąt wewnętrzny < 180), przeciwny = wklęsły
  return orientation !== 0 && Math.sign(turn) !== Math.sign(orientation) ? 360 - ang : ang;
}

export function roomFromScan(data: ScanData): Room {
  const walls = data.walls ?? [];
  // orientacja obrysu: pole ze znakiem (shoelace) po początkach ścian
  let area = 0;
  walls.forEach((w, i) => {
    const n = walls[(i + 1) % walls.length];
    area += w.x1 * n.y1 - n.x1 * w.y1;
  });
  const orientation = data.closed ? Math.sign(area) : 0;

  const out: RoomWall[] = walls.map((w, i) => {
    const c = w.curve;
    const lens = [c?.length_bottom, c?.length_middle, c?.length_top].filter(num);
    const hts = [c?.height_left, c?.height_middle, c?.height_right].filter(num);
    const measured = !!w.measured || lens.length > 0 || hts.length > 0;
    const length = Math.round(Math.min(w.length_mm, ...lens));
    const height = Math.round(Math.min(w.height_mm, ...hts));

    const obstacles: Obstacle[] = [];
    for (const s of openingSpans(w, data.openings ?? [])) {
      const op = (data.openings ?? []).find((o) => o.wall_id === w.id && Math.abs(o.sill_mm - s.bottom) < 1);
      obstacles.push({
        id: `${w.id}:${s.kind}:${Math.round(s.t0)}`,
        kind: s.kind,
        x0: s.t0,
        x1: s.t1,
        z0: s.bottom,
        z1: s.top,
        depth_mm: 0,
        label: SCAN_OPENING_LABELS[s.kind],
      });
      // parapet wewnętrzny: deska wystaje przed ścianę tuż pod oknem
      if (s.kind === "window" && op?.sill_depth_mm) {
        obstacles.push({
          id: `${w.id}:sill:${Math.round(s.t0)}`,
          kind: "sill",
          x0: s.t0,
          x1: s.t1,
          z0: Math.max(0, s.bottom - (op.sill_thickness_mm ?? 30)),
          z1: s.bottom,
          depth_mm: op.sill_depth_mm,
          label: "Parapet",
        });
      }
    }
    for (const f of (data.features ?? []).filter((f) => f.wall_id === w.id)) {
      obstacles.push({
        id: f.id,
        kind: FEATURE_TO_OBSTACLE[f.kind] ?? "box",
        x0: f.offset_mm,
        x1: f.offset_mm + f.width_mm,
        z0: f.elevation_mm,
        z1: f.elevation_mm + f.height_mm,
        depth_mm: f.depth_mm,
        access: f.access,
        label: FEATURE_LABELS[f.kind] ?? "Element",
      });
    }
    const points: ServicePoint[] = (data.markers ?? [])
      .filter((m) => m.wall_id === w.id)
      .map((m) => {
        const half = (m.width_mm ?? 0) / 2;
        return { id: m.id, kind: m.kind, x0: m.offset_mm - half, x1: m.offset_mm + half, z: m.height_mm, note: m.note };
      });

    const hasPrev = i > 0 || !!data.closed;
    const prev = walls[(i - 1 + walls.length) % walls.length];
    return {
      id: w.id,
      index: i,
      label: wallLabel(i),
      length_mm: length,
      height_mm: height,
      source: measured ? "dalmierz" : "lidar",
      length_dev_mm: Math.round(spread(lens)),
      height_dev_mm: Math.round(spread(hts)),
      corner_start_deg: hasPrev && walls.length > 1 ? Math.round(cornerAngle(prev, w, orientation) * 10) / 10 : null,
      planned: !!w.planned,
      obstacles: obstacles.sort((a, b) => a.x0 - b.x0),
      points: points.sort((a, b) => a.x0 - b.x0),
    };
  });

  return {
    walls: out,
    height_mm: data.room_height_mm ?? Math.max(0, ...out.map((w) => w.height_mm)),
    closed: !!data.closed,
  };
}

/** Pokój bez skanu: ściana A (i opcjonalnie B), proste kąty — jak dotychczasowy tryb ręczny. */
export function manualRoom(walls: { id: string; length_mm: number; height_mm: number }[]): Room {
  return {
    walls: walls.map((w, i) => ({
      id: w.id,
      index: i,
      label: wallLabel(i),
      length_mm: w.length_mm,
      height_mm: w.height_mm,
      source: "dalmierz" as const,
      length_dev_mm: 0,
      height_dev_mm: 0,
      corner_start_deg: i > 0 ? 90 : null,
      planned: false,
      obstacles: [],
      points: [],
    })),
    height_mm: Math.max(0, ...walls.map((w) => w.height_mm)),
    closed: false,
  };
}

/** Ręczna korekta pomiaru z projektanta (dalmierz w ręku) — wygrywa ze skanem. */
export function applyOverrides(room: Room, overrides: Record<string, WallOverride>): Room {
  return {
    ...room,
    walls: room.walls.map((w) => {
      const o = overrides[w.id];
      if (!o) return w;
      return {
        ...w,
        length_mm: o.length_mm && o.length_mm > 0 ? Math.round(o.length_mm) : w.length_mm,
        height_mm: o.height_mm && o.height_mm > 0 ? Math.round(o.height_mm) : w.height_mm,
        source: "dalmierz",
      };
    }),
  };
}
