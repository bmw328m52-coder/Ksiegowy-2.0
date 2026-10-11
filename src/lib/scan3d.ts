// Geometria 3D skanu — ta sama logika co Scan3D w aplikacji iPad
// (ios/LuvianoSkaner/Sources/Scan3DView.swift). Wszystko w mm.
import type { ScanOpening, ScanWall } from "@/lib/dao/room_scans.types";

/** Otwór na ścianie: wzdłuż ściany t0…t1, w pionie bottom…top. */
export type WallSpan = { t0: number; t1: number; bottom: number; top: number; kind: ScanOpening["kind"] };
/** Prostokąt ściany do narysowania: wzdłuż t0…t1, w pionie z0…z1. */
export type WallPiece = { t0: number; t1: number; z0: number; z1: number };

export function wallAxis(w: ScanWall) {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const len = Math.hypot(dx, dy);
  return { len, ux: len ? dx / len : 1, uy: len ? dy / len : 0 };
}

/** Otwory leżące na ścianie, rzutowane na jej oś. */
export function openingSpans(wall: ScanWall, openings: ScanOpening[]): WallSpan[] {
  const { len, ux, uy } = wallAxis(wall);
  const proj = (x: number, y: number) => (x - wall.x1) * ux + (y - wall.y1) * uy;
  const out: WallSpan[] = [];
  for (const o of openings) {
    if (o.wall_id) {
      if (o.wall_id !== wall.id) continue;
    } else {
      // Bez rodzica — bierzemy, jeśli środek otworu leży na tej ścianie.
      const mx = (o.x1 + o.x2) / 2;
      const my = (o.y1 + o.y2) / 2;
      const dist = Math.abs((mx - wall.x1) * -uy + (my - wall.y1) * ux);
      const t = proj(mx, my);
      if (dist >= 200 || t <= 0 || t >= len) continue;
    }
    const a = proj(o.x1, o.y1);
    const b = proj(o.x2, o.y2);
    const t0 = Math.max(0, Math.min(a, b));
    const t1 = Math.min(len, Math.max(a, b));
    const top = Math.min(o.sill_mm + o.height_mm, wall.height_mm);
    if (t1 - t0 > 1 && top > o.sill_mm) out.push({ t0, t1, bottom: o.sill_mm, top, kind: o.kind });
  }
  return out.sort((p, q) => p.t0 - q.t0);
}

/** Ściana pocięta na prostokąty omijające otwory. */
export function wallPieces(len: number, height: number, spans: WallSpan[]): WallPiece[] {
  const out: WallPiece[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.t0 > cursor) out.push({ t0: cursor, t1: s.t0, z0: 0, z1: height });
    const a = Math.max(s.t0, cursor);
    if (s.t1 > a) {
      if (s.bottom > 0) out.push({ t0: a, t1: s.t1, z0: 0, z1: s.bottom });
      if (s.top < height) out.push({ t0: a, t1: s.t1, z0: s.top, z1: height });
    }
    cursor = Math.max(cursor, s.t1);
  }
  if (cursor < len) out.push({ t0: cursor, t1: len, z0: 0, z1: height });
  return out;
}

/** Otoczka wypukła (monotone chain) — kształt podłogi z narożników ścian. */
export function convexHull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  const upper: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
