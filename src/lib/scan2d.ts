// Rzut 2D skanu w stylu MagicPlan — ta sama geometria co aplikacja iPad
// (ios/LuvianoSkaner/Sources/PlanGeom.swift + PlanCanvas.swift). Wszystko w mm.
// Moduł bez zależności runtime (tylko typy), żeby dało się go uruchomić poza Next.
import type { ScanData, ScanFeatureKind, ScanMarkerKind, ScanObject, ScanOpening, ScanWall } from "@/lib/dao/room_scans.types";

/** Punkty instalacji: nazwa, skrót na rzucie, kolor (jak MarkerKind w Markers.swift). */
export const SCAN_MARKER_KINDS: Record<ScanMarkerKind, { label: string; code: string; color: string }> = {
  water_cold: { label: "Woda zimna", code: "ZW", color: "#1f73d9" },
  water_hot: { label: "Woda ciepła", code: "CW", color: "#d93833" },
  drain: { label: "Odpływ", code: "K", color: "#6b6157" },
  socket: { label: "Gniazdko 230 V", code: "G", color: "#ed801a" },
  power_400: { label: "Siła 400 V", code: "400", color: "#8c45bf" },
  gas: { label: "Gaz", code: "GZ", color: "#d9ad00" },
  vent: { label: "Wentylacja", code: "WT", color: "#33998c" },
  light: { label: "Wypust światła", code: "Ś", color: "#bf8c1a" },
  switch: { label: "Włącznik", code: "Wł", color: "#8c734d" },
  other: { label: "Inne", code: "•", color: "#666666" },
};

/** Elementy na ścianach (jak FeatureKind w WallFeatures.swift). */
export const SCAN_FEATURE_KINDS: Record<ScanFeatureKind, { label: string; color: string }> = {
  radiator: { label: "Grzejnik", color: "#d94d40" },
  pipe_v: { label: "Rura pionowa", color: "#4d80b3" },
  pipe_h: { label: "Rura pozioma", color: "#4d80b3" },
  fuse_box: { label: "Skrzynka elektryczna", color: "#ed801a" },
  riser: { label: "Pion / obudowa pionu", color: "#6b6157" },
  beam: { label: "Belka / podciąg", color: "#737373" },
  box: { label: "Inny element", color: "#808080" },
};

export const featureKind = (k: string) => SCAN_FEATURE_KINDS[k as ScanFeatureKind] ?? SCAN_FEATURE_KINDS.box;

export const markerKind = (k: string) => SCAN_MARKER_KINDS[k as ScanMarkerKind] ?? SCAN_MARKER_KINDS.other;

export type V2 = [number, number];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0];
const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Grubość rysowanej ściany (od linii skanu na zewnątrz). */
export const WALL_T = 100;

/** Otwór na ścianie: wzdłuż ściany t0…t1, w pionie bottom…top. */
export type WallSpan = {
  t0: number;
  t1: number;
  bottom: number;
  top: number;
  kind: ScanOpening["kind"];
  /** Zmierzone odcinki (ScanOpening.measured_parts). */
  parts: string[];
};
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
      const mx = (o.x1 + o.x2) / 2;
      const my = (o.y1 + o.y2) / 2;
      const d = Math.abs((mx - wall.x1) * -uy + (my - wall.y1) * ux);
      const t = proj(mx, my);
      if (d >= 200 || t <= 0 || t >= len) continue;
    }
    const a = proj(o.x1, o.y1);
    const b = proj(o.x2, o.y2);
    const t0 = Math.max(0, Math.min(a, b));
    const t1 = Math.min(len, Math.max(a, b));
    const top = Math.min(o.sill_mm + o.height_mm, wall.height_mm);
    if (t1 - t0 > 1 && top > o.sill_mm) out.push({ t0, t1, bottom: o.sill_mm, top, kind: o.kind, parts: o.measured_parts ?? [] });
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

/** Otoczka wypukła (monotone chain). */
export function convexHull(pts: V2[]): V2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const c = (o: V2, a: V2, b: V2) => cross(sub(a, o), sub(b, o));
  const lower: V2[] = [];
  const upper: V2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && c(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && c(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function segDist(p: V2, a: V2, b: V2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 > 0 ? Math.min(Math.max(dot(sub(p, a), ab) / l2, 0), 1) : 0;
  return dist(p, add(a, mul(ab, t)));
}

/** Obrys podłogi z RoomPlan pasuje do ścian (port PlanGeom.floorMatches) — po przesunięciu ścian podłoga idzie za ścianami. */
function floorMatches(floor: V2[], walls: [V2, V2][], gap: [V2, V2] | null, tol = 120): boolean {
  if (floor.length < 3 || !walls.length) return false;
  const edges = floor.map((p, i): [V2, V2] => [p, floor[(i + 1) % floor.length]]);
  const segs = gap ? [...walls, gap] : walls;
  const endsOnFloor = walls.flat().every((p) => edges.some(([a, b]) => segDist(p, a, b) <= tol));
  const floorOnWalls = floor.every((p) => segs.some(([a, b]) => segDist(p, a, b) <= tol));
  return endsOnFloor && floorOnWalls;
}

function pointInPolygon(p: V2, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export type PlanWall = {
  w: ScanWall;
  a: V2;
  b: V2;
  dir: V2;
  /** Normalna do wnętrza pomieszczenia. */
  inN: V2;
  out: V2;
  len: number;
  spans: WallSpan[];
  prev: number | null;
  next: number | null;
};

export type PlanModel = {
  walls: PlanWall[];
  objects: ScanObject[];
  floor: V2[];
  closed: boolean;
  /** Domknięcie otwartego obrysu (linia przerywana). */
  gap: [V2, V2] | null;
  center: V2;
  roomHeight: number;
};

const at = (g: PlanWall, t: number, off = 0): V2 => add(add(g.a, mul(g.dir, t)), mul(g.out, off));

export function planModel(data: ScanData): PlanModel {
  const ws = data.walls;
  const A = (w: ScanWall): V2 => [w.x1, w.y1];
  const B = (w: ScanWall): V2 => [w.x2, w.y2];
  // Przy rozgałęzieniu (dorysowana ścianka działowa) obrys idzie po istniejących ścianach.
  const nextOf = (i: number) => {
    const c = ws.map((w, j) => j).filter((j) => j !== i && dist(A(ws[j]), B(ws[i])) < 1);
    return c.find((j) => !ws[j].planned) ?? c[0] ?? -1;
  };

  let loop: V2[] = [];
  if (ws.length >= 3) {
    let idx = 0;
    const seen = new Set<number>();
    while (!seen.has(idx)) {
      seen.add(idx);
      loop.push(A(ws[idx]));
      const n = nextOf(idx);
      if (n < 0) {
        loop = [];
        break;
      }
      idx = n;
    }
    if (idx !== 0) loop = [];
  }
  const closed = loop.length >= 3;

  let gap: [V2, V2] | null = null;
  if (!closed && ws.length >= 2) {
    const startI = ws.findIndex((w, i) => !ws.some((v, j) => j !== i && dist(B(v), A(w)) < 1));
    let idx = startI >= 0 ? startI : 0;
    const seen = new Set<number>();
    const pts: V2[] = [];
    while (!seen.has(idx)) {
      seen.add(idx);
      pts.push(A(ws[idx]));
      const n = nextOf(idx);
      if (n < 0) {
        pts.push(B(ws[idx]));
        break;
      }
      idx = n;
    }
    if (pts.length >= 3) {
      loop = pts;
      gap = [pts[pts.length - 1], pts[0]];
    }
  }
  const rp = (data.floor ?? []).filter((p) => p.length >= 2).map((p): V2 => [p[0], p[1]]);
  if (!closed && rp.length >= 3 && (loop.length < 3 || floorMatches(rp, ws.map((w): [V2, V2] => [A(w), B(w)]), gap))) {
    loop = rp;
    gap = null;
  }
  const corners = ws.flatMap((w) => [A(w), B(w)]);
  const floor = loop.length >= 3 ? loop : convexHull(corners);
  const pts = floor.length ? floor : corners;
  const center: V2 = pts.length ? mul(pts.reduce(add, [0, 0] as V2), 1 / pts.length) : [0, 0];

  const walls = ws.map((w): PlanWall => {
    const a = A(w);
    const b = B(w);
    const len = dist(a, b);
    const dir: V2 = len ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len] : [1, 0];
    const n: V2 = [-dir[1], dir[0]];
    const mid = mul(add(a, b), 0.5);
    const inward =
      floor.length >= 3 ? (pointInPolygon(add(mid, mul(n, 40)), floor) ? n : mul(n, -1)) : dot(sub(center, mid), n) >= 0 ? n : mul(n, -1);
    const prev = ws.findIndex((v) => v.id !== w.id && dist(B(v), a) < 1);
    const next = ws.findIndex((v) => v.id !== w.id && dist(A(v), b) < 1);
    return {
      w,
      a,
      b,
      dir,
      inN: inward,
      out: mul(inward, -1),
      len,
      spans: openingSpans(w, data.openings),
      prev: prev >= 0 ? prev : null,
      next: next >= 0 ? next : null,
    };
  });

  return {
    walls,
    objects: data.objects,
    floor,
    closed,
    gap,
    center,
    roomHeight: data.room_height_mm ?? Math.max(2500, ...ws.map((w) => w.height_mm)),
  };
}

function miter(g: PlanWall, h: PlanWall, corner: V2, off: number): V2 | null {
  const p1 = add(g.a, mul(g.out, off));
  const p2 = add(h.a, mul(h.out, off));
  const den = cross(g.dir, h.dir);
  if (Math.abs(den) <= 0.05) return null;
  const t = cross(sub(p2, p1), h.dir) / den;
  const r = add(p1, mul(g.dir, t));
  return dist(r, corner) < off * 4 ? r : null;
}

/** Zewnętrzna krawędź ściany odsuniętej o `off`, narożniki na ucios. */
export function outerEdge(m: PlanModel, i: number, off: number): [V2, V2] {
  const g = m.walls[i];
  let s = at(g, 0, off);
  let e = at(g, g.len, off);
  if (g.prev !== null) s = miter(g, m.walls[g.prev], g.a, off) ?? s;
  if (g.next !== null) e = miter(g, m.walls[g.next], g.b, off) ?? e;
  return [s, e];
}

export function planStats(m: PlanModel) {
  let a = 0;
  for (let i = 0; i < m.floor.length; i++) {
    const p = m.floor[i];
    const q = m.floor[(i + 1) % m.floor.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  const areaM2 = m.floor.length >= 3 ? Math.abs(a) / 2 / 1e6 : 0;
  const perimeterM = m.walls.reduce((s, g) => s + g.len, 0) / 1000;
  const wallAreaM2 =
    m.walls.reduce((s, g) => s + g.len * g.w.height_mm - g.spans.reduce((x, sp) => x + (sp.t1 - sp.t0) * (sp.top - sp.bottom), 0), 0) / 1e6;
  return { areaM2, perimeterM, wallAreaM2, volumeM3: (areaM2 * m.roomHeight) / 1000 };
}

/* ---------------------------------------------------------------- SVG ---- */

const INK = "#141414";
const BAND = "#c4c4c4";
const DIM = "#4b4b4b";
const MEASURED = "#1f73d9";
const GRID_MINOR = "#ececec";
const GRID_MAJOR = "#f5d6c2";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const P = (p: V2) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const poly = (pts: V2[], attrs: string) => `<polygon points="${pts.map(P).join(" ")}" ${attrs}/>`;
const line = (a: V2, b: V2, attrs: string) =>
  `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" ${attrs}/>`;

function readableAngle(d: V2) {
  let a = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
  if (a > 90.5) a -= 180;
  if (a < -89.5) a += 180;
  return a;
}

/** Linia wymiarowa p1→p2 odsunięta o `off` (mm) w kierunku `out`. */
function dimension(p1: V2, p2: V2, out: V2, off: number, text: string, color: string, u: number, locked = false) {
  const q1 = add(p1, mul(out, off));
  const q2 = add(p2, mul(out, off));
  const l = dist(q1, q2) || 1;
  const d: V2 = [(q2[0] - q1[0]) / l, (q2[1] - q1[1]) / l];
  const n: V2 = [-d[1], d[0]];
  const a = 7 * u;
  const w = 2.6 * u;
  const fs = 12 * u;
  const label = locked ? `${text} 🔒` : text;
  const tw = label.length * fs * 0.58 + 8 * u;
  const mid = mul(add(q1, q2), 0.5);
  const ang = readableAngle(d);
  let s = "";
  s += line(add(p1, mul(out, 3 * u)), add(q1, mul(out, 5 * u)), `stroke="#8c8c8c" stroke-width="${0.6 * u}"`);
  s += line(add(p2, mul(out, 3 * u)), add(q2, mul(out, 5 * u)), `stroke="#8c8c8c" stroke-width="${0.6 * u}"`);
  s += line(q1, q2, `stroke="${color}" stroke-width="${0.9 * u}"`);
  if (l > 2 * a + 4 * u) {
    s += poly([q1, add(add(q1, mul(d, a)), mul(n, w)), add(add(q1, mul(d, a)), mul(n, -w))], `fill="${color}"`);
    s += poly([q2, add(add(q2, mul(d, -a)), mul(n, w)), add(add(q2, mul(d, -a)), mul(n, -w))], `fill="${color}"`);
  }
  s += `<g transform="translate(${P(mid).replace(",", " ")}) rotate(${ang.toFixed(1)})">`;
  s += `<rect x="${(-tw / 2).toFixed(1)}" y="${(-fs * 0.6).toFixed(1)}" width="${tw.toFixed(1)}" height="${(fs * 1.2).toFixed(1)}" fill="#f1f1f0"/>`;
  s += `<text x="0" y="0" font-size="${fs.toFixed(1)}" font-weight="500" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,-apple-system,sans-serif">${esc(label)}</text></g>`;
  return s;
}

function symbol(o: ScanObject, u: number): string {
  const w = o.width_mm;
  const h = o.depth_mm;
  const x0 = -w / 2;
  const y0 = -h / 2;
  const s = Math.min(w, h);
  const st = `stroke="${INK}" stroke-width="${0.8 * u}" fill="none"`;
  const rect = (x: number, y: number, rw: number, rh: number, extra = st) =>
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" ${extra}/>`;
  const label = (t: string) =>
    `<text x="0" y="0" font-size="${Math.max(7 * u, Math.min(11 * u, s * 0.22)).toFixed(1)}" font-weight="600" fill="${INK}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif">${t}</text>`;
  // Szafka wisząca — linia przerywana z przekątną (jak na rysunku technicznym).
  if (o.category === "storage" && (o.elevation_mm ?? 0) >= 1000) {
    const dash = `stroke="${INK}" stroke-width="${0.8 * u}" stroke-dasharray="${5 * u} ${3 * u}"`;
    return `<g transform="translate(${o.cx.toFixed(1)} ${o.cy.toFixed(1)}) rotate(${o.rotation_deg.toFixed(1)})">${rect(x0, y0, w, h, `fill="#fff" fill-opacity="0.35" ${dash}`)}${line([x0, y0], [-x0, -y0], `${dash} fill="none"`)}</g>`;
  }
  let g = rect(x0, y0, w, h, `fill="#fff" stroke="${INK}" stroke-width="${u}"`);
  switch (o.category) {
    case "storage":
      g += line([x0, y0], [-x0, -y0], st) + line([x0, -y0 - s * 0.12], [-x0, -y0 - s * 0.12], st);
      break;
    case "refrigerator":
      g += rect(x0 + s * 0.08, y0 + s * 0.08, w - s * 0.16, h - s * 0.16) + label("LOD");
      break;
    case "stove": {
      const r = s * 0.17;
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ])
        g += `<circle cx="${((dx * w) / 4).toFixed(1)}" cy="${((dy * h) / 4).toFixed(1)}" r="${r.toFixed(1)}" ${st}/>`;
      break;
    }
    case "oven":
      g += rect(x0 + s * 0.12, y0 + s * 0.12, w - s * 0.24, h - s * 0.24);
      break;
    case "dishwasher":
      g += rect(x0 + s * 0.1, y0 + s * 0.1, w - s * 0.2, h - s * 0.2) + label("ZM");
      break;
    case "sink":
      g += `<rect x="${(x0 + w * 0.14).toFixed(1)}" y="${(y0 + h * 0.18).toFixed(1)}" width="${(w * 0.72).toFixed(1)}" height="${(h * 0.64).toFixed(1)}" rx="${(s * 0.12).toFixed(1)}" ${st}/>`;
      g += `<circle cx="0" cy="0" r="${(2.5 * u).toFixed(1)}" ${st}/>`;
      break;
    case "washerDryer":
      g += `<circle cx="0" cy="0" r="${(s * 0.32).toFixed(1)}" ${st}/>`;
      break;
    case "sofa": {
      const ix = x0 + w * 0.1;
      const iy = y0 + h * 0.28;
      const iw = w * 0.8;
      g += rect(ix, iy, iw, h * 0.72);
      const seats = Math.max(1, Math.round(w / 700));
      for (let k = 1; k < seats; k++) g += line([ix + (iw * k) / seats, iy], [ix + (iw * k) / seats, -y0], st);
      break;
    }
    case "bed":
      g += line([x0, y0 + h * 0.25], [-x0, y0 + h * 0.25], st);
      for (const dx of [-1, 1]) g += rect((dx * w) / 4 - w * 0.19, y0 + h * 0.05, w * 0.38, h * 0.14);
      break;
    case "chair":
      g += line([x0, y0 + h * 0.2], [-x0, y0 + h * 0.2], st);
      break;
    case "toilet":
      g += `<ellipse cx="0" cy="${(h * 0.1).toFixed(1)}" rx="${(w * 0.35).toFixed(1)}" ry="${(h * 0.4).toFixed(1)}" ${st}/>`;
      break;
    case "bathtub":
      g += `<rect x="${(x0 + s * 0.12).toFixed(1)}" y="${(y0 + s * 0.12).toFixed(1)}" width="${(w - s * 0.24).toFixed(1)}" height="${(h - s * 0.24).toFixed(1)}" rx="${(s * 0.2).toFixed(1)}" ${st}/>`;
      break;
  }
  return `<g transform="translate(${o.cx.toFixed(1)} ${o.cy.toFixed(1)}) rotate(${o.rotation_deg.toFixed(1)})">${g}</g>`;
}

/** Litery ścian: A, B, C… */
export function wallLetter(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : `W${i + 1}`;
}

/** Rzut 2D jako SVG (viewBox w mm). `uid` — unikalny sufiks id (clipPath). */
export function planSvg(data: ScanData, opts: { name?: string; uid?: string; letters?: boolean } = {}): string {
  const m = planModel(data);
  if (!m.walls.length) return "";
  const T = WALL_T;
  const all = [...m.walls.flatMap((g) => [g.a, g.b]), ...m.floor];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const size = Math.max(maxX - minX, maxY - minY, 1500);
  const u = size / 560; // ~1 px przy szerokości ~700 px
  const pad = 96 * u;
  const vb = [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad];
  const uid = opts.uid ?? "p";
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map((v) => v.toFixed(0)).join(" ")}" width="100%" style="display:block;background:#f1f1f0">`;

  // Podłoga w kratkę.
  if (m.floor.length >= 3) {
    const fp = m.floor.map(P).join(" ");
    s += `<defs><clipPath id="fl-${uid}"><polygon points="${fp}"/></clipPath></defs>`;
    s += `<polygon points="${fp}" fill="#fff"/>`;
    s += `<g clip-path="url(#fl-${uid})">`;
    for (let x = Math.floor(minX / 100) * 100; x <= maxX; x += 100)
      s += line([x, minY], [x, maxY], `stroke="${Math.round(x / 100) % 5 === 0 ? GRID_MAJOR : GRID_MINOR}" stroke-width="${0.6 * u}"`);
    for (let y = Math.floor(minY / 100) * 100; y <= maxY; y += 100)
      s += line([minX, y], [maxX, y], `stroke="${Math.round(y / 100) % 5 === 0 ? GRID_MAJOR : GRID_MINOR}" stroke-width="${0.6 * u}"`);
    s += `</g>`;
    if (!m.closed && !m.gap)
      s += `<polygon points="${fp}" fill="none" stroke="#808080" stroke-width="${u}" stroke-dasharray="${5 * u} ${4 * u}"/>`;
  }

  // Szary pas + czarna ściana.
  m.walls.forEach((g, i) => {
    if (g.w.planned) return;
    const [o1a, o1b] = outerEdge(m, i, T);
    const [o2a, o2b] = outerEdge(m, i, T * 1.9);
    s += poly([o1a, o1b, o2b, o2a], `fill="${BAND}"`);
  });
  m.walls.forEach((g, i) => {
    const [oa, ob] = outerEdge(m, i, T);
    if (g.w.planned) {
      // Do wybudowania: kreskowanie zamiast czarnej ściany.
      s += `<defs><pattern id="ht-${uid}" patternUnits="userSpaceOnUse" width="${8 * u}" height="${8 * u}" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${8 * u}" stroke="${INK}" stroke-width="${u}"/></pattern></defs>`;
      s += poly([g.a, g.b, ob, oa], `fill="url(#ht-${uid})" stroke="${INK}" stroke-width="${1.2 * u}"`);
      return;
    }
    s += poly([g.a, g.b, ob, oa], `fill="${INK}"`);
  });

  // Otwory.
  for (const g of m.walls) {
    for (const sp of g.spans) {
      s += poly([at(g, sp.t0, -2), at(g, sp.t1, -2), at(g, sp.t1, T * 1.9 + 2), at(g, sp.t0, T * 1.9 + 2)], `fill="#fff"`);
      const st = `stroke="${INK}" stroke-width="${u}" fill="none"`;
      if (sp.kind === "window") {
        s += poly([at(g, sp.t0, 0), at(g, sp.t1, 0), at(g, sp.t1, T), at(g, sp.t0, T)], st);
        s += line(at(g, sp.t0, T * 0.4), at(g, sp.t1, T * 0.4), st);
        s += line(at(g, sp.t0, T * 0.6), at(g, sp.t1, T * 0.6), st);
      } else if (sp.kind === "door") {
        const w = sp.t1 - sp.t0;
        const hinge = at(g, sp.t0);
        const leaf = add(hinge, mul(g.inN, w));
        s += line(hinge, leaf, `stroke="${INK}" stroke-width="${1.4 * u}"`);
        const arc: V2[] = [];
        for (let k = 0; k <= 24; k++) {
          const f = ((k / 24) * Math.PI) / 2;
          arc.push(add(add(hinge, mul(g.inN, w * Math.cos(f))), mul(g.dir, w * Math.sin(f))));
        }
        s += `<polyline points="${arc.map(P).join(" ")}" ${st}/>`;
        s += line(at(g, sp.t0, 0), at(g, sp.t0, T), st) + line(at(g, sp.t1, 0), at(g, sp.t1, T), st);
      }
    }
  }

  // Elementy na ścianach: odstające jako prostokąt przy ścianie, w licu — kolorowa kreska.
  for (const f of data.features ?? []) {
    const g = m.walls.find((w) => w.w.id === f.wall_id);
    if (!g) continue;
    const k = featureKind(f.kind);
    const t0 = Math.min(Math.max(f.offset_mm, 0), g.len);
    const t1 = Math.min(Math.max(f.offset_mm + f.width_mm, 0), g.len);
    if (t1 - t0 <= 1) continue;
    if (f.depth_mm < 1) {
      s += line(at(g, t0, -3), at(g, t1, -3), `stroke="${k.color}" stroke-width="${4 * u}"`);
    } else {
      const high = f.elevation_mm >= 1500;
      s += poly([at(g, t0, 0), at(g, t1, 0), at(g, t1, -f.depth_mm), at(g, t0, -f.depth_mm)],
        `fill="${k.color}" fill-opacity="${high ? 0.08 : 0.22}" stroke="${k.color}" stroke-width="${1.2 * u}"${high ? ` stroke-dasharray="${5 * u} ${3 * u}"` : ""}`);
    }
  }

  // Szafy (szkic z iPada): prostokąt przy ścianie.
  for (const w of data.wardrobes ?? []) {
    const g = m.walls.find((x) => x.w.id === w.wall_id);
    if (!g) continue;
    const t0 = w.offset_mm;
    const t1 = w.offset_mm + w.width_mm;
    s += poly([at(g, t0, 0), at(g, t1, 0), at(g, t1, -w.depth_mm), at(g, t0, -w.depth_mm)],
      `fill="#ddcbb3" fill-opacity="0.55" stroke="#8c7354" stroke-width="${1.2 * u}"`);
    const c = at(g, (t0 + t1) / 2, -w.depth_mm / 2);
    s += `<text x="${c[0].toFixed(1)}" y="${c[1].toFixed(1)}" font-size="${(11 * u).toFixed(1)}" font-weight="600" fill="#8c7354" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif">Szafa</text>`;
  }

  for (const o of m.objects) s += symbol(o, u);

  // Punkty instalacji przy wewnętrznej krawędzi ściany.
  for (const mk of data.markers ?? []) {
    const g = m.walls.find((w) => w.w.id === mk.wall_id);
    if (!g) continue;
    const k = markerKind(mk.kind);
    const c = add(at(g, Math.min(Math.max(mk.offset_mm, 0), g.len)), mul(g.inN, 13 * u));
    s += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(9 * u).toFixed(1)}" fill="${k.color}" stroke="#fff" stroke-width="${(1.5 * u).toFixed(1)}"/>`;
    s += `<text x="${c[0].toFixed(1)}" y="${c[1].toFixed(1)}" font-size="${((k.code.length > 2 ? 6 : 7.5) * u).toFixed(1)}" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif">${esc(k.code)}</text>`;
  }

  if (m.gap) s += line(m.gap[0], m.gap[1], `stroke="#808080" stroke-width="${u}" stroke-dasharray="${5 * u} ${4 * u}"`);

  // Wymiary.
  m.walls.forEach((g, i) => {
    const base = T * 1.9;
    let row = base + 18 * u;
    if (g.spans.length) {
      // Łańcuch jak PlanGeom.horizontalSegments: przerwa przed otworem, szerokość, przerwa za ostatnim.
      const segs: { a: number; b: number; measured: boolean }[] = [];
      let cursor = 0;
      for (const sp of g.spans) {
        segs.push({ a: cursor, b: sp.t0, measured: sp.parts.includes("before") });
        segs.push({ a: sp.t0, b: sp.t1, measured: sp.parts.includes("width") });
        cursor = sp.t1;
      }
      segs.push({ a: cursor, b: g.len, measured: g.spans[g.spans.length - 1].parts.includes("after") });
      for (const d of segs) {
        if (d.b - d.a <= 30 * u) continue;
        s += dimension(at(g, d.a), at(g, d.b), g.out, base + 18 * u, String(Math.round(d.b - d.a)), d.measured ? MEASURED : DIM, u, d.measured);
      }
      row += 26 * u;
    }
    const locked = g.w.measured === true;
    s += dimension(g.a, g.b, g.out, row, String(Math.round(g.len)), locked ? MEASURED : INK, u, locked);

    if (opts.letters !== false) {
      const c = add(at(g, g.len / 2), mul(g.inN, 20 * u));
      s += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(8 * u).toFixed(1)}" fill="#e6e6e4"/>`;
      s += `<text x="${c[0].toFixed(1)}" y="${c[1].toFixed(1)}" font-size="${(9.5 * u).toFixed(1)}" font-weight="700" fill="${INK}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif">${wallLetter(i)}</text>`;
    }
  });

  // Nazwa i powierzchnia.
  if (m.floor.length >= 3) {
    const { areaM2 } = planStats(m);
    const c = m.center;
    if (opts.name)
      s += `<text x="${c[0].toFixed(1)}" y="${(c[1] - 9 * u).toFixed(1)}" font-size="${(15 * u).toFixed(1)}" font-weight="600" fill="${INK}" text-anchor="middle" font-family="system-ui,sans-serif">${esc(opts.name)}</text>`;
    s += `<text x="${c[0].toFixed(1)}" y="${(c[1] + 10 * u).toFixed(1)}" font-size="${(12 * u).toFixed(1)}" fill="#666" text-anchor="middle" font-family="system-ui,sans-serif">${areaM2.toFixed(2).replace(".", ",")} m²</text>`;
  }

  return s + `</svg>`;
}
