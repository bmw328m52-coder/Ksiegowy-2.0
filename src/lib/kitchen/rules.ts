// Reguły projektanta kuchni: geometria szafek na ścianach, kolizje z przeszkodami, strefy robocze.
// Czyste funkcje (bez Reacta) — te same wywołuje UI (podświetlanie) i serwer (blokada zapisu / wyceny).

import { libById, type LibCab } from "../cabinetLibrary";
import type { Issue, Layer, Obstacle, Placed, Room, RoomWall, ServicePoint } from "./types";

export const PLINTH = 150;
export const COUNTER_T = 38;
export const LOWER_H = 720;
/** Wierzch blatu od podłogi. */
export const WORKTOP_TOP = PLINTH + LOWER_H + COUNTER_T;
/** Luz między szafką pod sufit a sufitem (kompensacja krzywizn, listwa maskująca). */
export const CEILING_GAP = 20;
/** Margines przy ścianie krzywej (docinka / blenda maskująca). */
export const CURVE_SCRIBE = 10;

export type Dims = { x0: number; x1: number; z0: number; z1: number; d: number; layer: Layer; lib: LibCab };

export const layerOf = (c: LibCab): Layer => (c.group === "tall" ? "both" : c.elev > 0 ? "up" : "low");
export const clash = (a: Layer, b: Layer) => a === "both" || b === "both" || a === b;

/** Bryła szafki na ścianie z uwzględnieniem „pod sufit" i nadpisania wysokości. */
export function dimsOf(p: Placed, wall: RoomWall): Dims | null {
  const lib = libById(p.libId);
  if (!lib) return null;
  const layer = layerOf(lib);
  const z0 = lib.elev > 0 ? lib.elev : PLINTH;
  let h = p.h ?? lib.h;
  if (p.to_ceiling && layer !== "low") h = Math.max(100, wall.height_mm - CEILING_GAP - z0);
  return { x0: p.x, x1: p.x + p.w, z0, z1: z0 + h, d: lib.d, layer, lib };
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
const hit = (a0: number, a1: number, b0: number, b1: number, tol = 0.5) => overlap(a0, a1, b0, b1) > tol;

/** Pas po stronie ściany zajęty przez narożną szafkę z sąsiedniej ściany (głębokość ramienia). */
export function reserve(room: Room, items: Placed[], wallIdx: number, layer: Layer): { start: number; end: number } {
  let start = 0;
  let end = 0;
  const w = room.walls[wallIdx];
  const n = room.walls.length;
  const prev = wallIdx > 0 ? room.walls[wallIdx - 1] : room.closed && n > 1 ? room.walls[n - 1] : undefined;
  const next = wallIdx < n - 1 ? room.walls[wallIdx + 1] : room.closed && n > 1 ? room.walls[0] : undefined;
  for (const o of items) {
    const lib = libById(o.libId);
    if (!lib?.corner || !clash(layer, layerOf(lib))) continue;
    if (prev && o.wall === prev.id && o.x + o.w >= prev.length_mm - 1) start = Math.max(start, lib.corner.armB);
    if (next && o.wall === next.id && o.x <= 1) end = Math.max(end, lib.corner.armB);
  }
  void w;
  return { start, end };
}

/** Czy szafka mieści się w danym miejscu (ściana, sąsiedzi, narożniki z sąsiednich ścian). */
export function fits(room: Room, rest: Placed[], libId: string, w: number, x: number, wallId: string): boolean {
  const lib = libById(libId);
  const wall = room.walls.find((s) => s.id === wallId);
  if (!lib || !wall || wall.planned) return false;
  const L = layerOf(lib);
  if (x < -0.5 || x + w > wall.length_mm + 0.5) return false;
  if (!lib.corner) {
    const r = reserve(room, rest, wall.index, L);
    if (x < r.start - 0.5 || x + w > wall.length_mm - r.end + 0.5) return false;
  }
  return !rest.some((o) => {
    const ol = libById(o.libId);
    return o.wall === wallId && ol && clash(L, layerOf(ol)) && hit(x, x + w, o.x, o.x + o.w);
  });
}

const roleOf = (p: Placed) => libById(p.libId)?.role;
const named = (p: Placed) => libById(p.libId)?.name ?? p.libId;

const nearPoint = (a: Dims, pt: ServicePoint, reach: number) => pt.x1 >= a.x0 - reach && pt.x0 <= a.x1 + reach;
const insidePoint = (a: Dims, pt: ServicePoint) => pt.x1 > a.x0 && pt.x0 < a.x1;

function obstacleIssue(d: Dims, p: Placed, o: Obstacle, wall: RoomWall): Issue | null {
  if (!hit(d.x0, d.x1, o.x0, o.x1)) return null;
  const zHit = overlap(d.z0, d.z1, o.z0, o.z1) > 0;
  const mk = (level: Issue["level"], code: string, msg: string): Issue => ({ level, code, msg, uid: p.uid, wall: wall.id });
  const name = named(p);
  switch (o.kind) {
    case "window":
      if (d.layer !== "low" && zHit) return mk("error", "window_collision", `${name}: zasłania okno (ściana ${wall.label}).`);
      // blat / dolna szafka a parapet: okno zaczynające się poniżej wierzchu blatu = kolizja ze szkłem
      if (d.layer !== "up" && o.z0 < WORKTOP_TOP) return mk("error", "window_sill_low", `${name}: parapet okna (${Math.round(o.z0)} mm) niżej niż blat (${WORKTOP_TOP} mm).`);
      return null;
    case "door":
    case "opening":
      return zHit ? mk("error", "door_collision", `${name}: stoi w ${o.label.toLowerCase()} (ściana ${wall.label}).`) : null;
    case "sill":
      return d.layer !== "up" && o.depth_mm > 0 && d.z1 > o.z0 - 1 && d.z0 < o.z1
        ? mk("warn", "sill_depth", `${name}: parapet wystaje ${Math.round(o.depth_mm)} mm — docinka blatu.`)
        : null;
    case "radiator":
      if (!zHit) return null;
      return mk(o.access ? "error" : "warn", "radiator_collision", `${name}: koliduje z grzejnikiem (${o.access ? "wymaga dostępu" : "przesuń / zabuduj kratką"}).`);
    case "fuse_box":
      if (!zHit) return null;
      return mk("error", "fuse_box_blocked", `${name}: zabudowuje skrzynkę bezpieczników — wymagany dostęp (osobne drzwiczki / zostaw wolne).`);
    case "beam":
      return zHit ? mk("error", "beam_collision", `${name}: koliduje z belką / podciągiem.`) : null;
    case "pipe":
    case "riser":
    case "box":
      if (!zHit) return null;
      if (o.depth_mm <= 0) return null; // w licu ściany — nie przeszkadza
      return mk(o.access ? "error" : "warn", "protrusion", `${name}: ${o.label.toLowerCase()} wystaje ${Math.round(o.depth_mm)} mm — wycięcie w korpusie / zabudowa${o.access ? " z dostępem" : ""}.`);
  }
}

/** Kolizje szafek ze sobą na jednej ścianie (nakładanie w tej samej warstwie). */
function overlapIssues(room: Room, items: Placed[]): Issue[] {
  const out: Issue[] = [];
  for (const wall of room.walls) {
    const here = items.filter((p) => p.wall === wall.id);
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        const a = libById(here[i].libId);
        const b = libById(here[j].libId);
        if (a && b && clash(layerOf(a), layerOf(b)) && hit(here[i].x, here[i].x + here[i].w, here[j].x, here[j].x + here[j].w))
          out.push({ level: "error", code: "overlap", msg: `${a.name} i ${b.name} nakładają się (ściana ${wall.label}).`, uid: here[i].uid, wall: wall.id });
      }
    }
  }
  return out;
}

export function checkProject(room: Room, items: Placed[]): Issue[] {
  const out: Issue[] = [...overlapIssues(room, items)];
  const byWall = new Map(room.walls.map((w) => [w.id, w]));

  for (const p of items) {
    const wall = byWall.get(p.wall);
    if (!wall) {
      out.push({ level: "error", code: "no_wall", msg: `${named(p)}: ściana nie istnieje w pomiarze.`, uid: p.uid });
      continue;
    }
    const d = dimsOf(p, wall);
    if (!d) continue;
    const mk = (level: Issue["level"], code: string, msg: string): Issue => ({ level, code, msg, uid: p.uid, wall: wall.id });
    const name = d.lib.name;

    if (wall.planned) out.push(mk("warn", "planned_wall", `${name}: ściana ${wall.label} jest jeszcze do wybudowania — wymiary orientacyjne.`));
    if (d.x0 < -0.5 || d.x1 > wall.length_mm + 0.5) out.push(mk("error", "out_of_wall", `${name}: wystaje poza ścianę ${wall.label} (${wall.length_mm} mm).`));
    if (d.z1 > wall.height_mm + 0.5) out.push(mk("error", "above_ceiling", `${name}: sięga ${Math.round(d.z1)} mm, a sufit jest na ${wall.height_mm} mm.`));
    else if (d.layer !== "low" && wall.height_mm - d.z1 < 5 && !p.to_ceiling) out.push(mk("warn", "tight_ceiling", `${name}: luz do sufitu < 5 mm — przy krzywym suficie nie wejdzie.`));

    // ściana krzywa: szafki dociśnięte do obu końców nie mają luzu na docinkę
    if (wall.length_dev_mm >= 5 && d.x0 <= CURVE_SCRIBE && d.x1 >= wall.length_mm - CURVE_SCRIBE)
      out.push(mk("warn", "curved_wall_tight", `Ściana ${wall.label} jest krzywa (${wall.length_dev_mm} mm) — zostaw ${CURVE_SCRIBE} mm luzu albo blendę docinaną.`));

    for (const o of wall.obstacles) {
      const i = obstacleIssue(d, p, o, wall);
      if (i) out.push(i);
    }

    // głębokość a drzwi: szafka dolna głębsza niż 600 blokuje przejście przy drzwiach naprzeciwko — tylko informacja
    if (d.layer !== "up" && d.d > 600) out.push(mk("info", "deep_cabinet", `${name}: głębokość ${d.d} mm — sprawdź przejście.`));

    // instalacje za szafką
    for (const pt of wall.points) {
      if (!insidePoint(d, pt)) continue;
      const behind = pt.z >= d.z0 && pt.z <= d.z1;
      if (!behind) continue;
      const role = d.lib.role;
      if ((pt.kind === "drain" || pt.kind === "water_cold" || pt.kind === "water_hot") && role !== "sink" && role !== "dishwasher") {
        const drawers = (d.lib.drawers ?? 0) > 0;
        out.push(mk(drawers ? "error" : "warn", "plumbing_behind", `${name}: ${pt.kind === "drain" ? "odpływ" : "woda"} za szafką${drawers ? " z szufladami — szuflady się nie wysuną" : " — wycięcie w plecach / przesuń punkt"}.`));
      }
      if ((pt.kind === "socket" || pt.kind === "switch" || pt.kind === "light") && !(role === "oven" || role === "fridge" || role === "dishwasher" || role === "hob"))
        out.push(mk("warn", "socket_behind", `${name}: zasłania ${pt.kind === "socket" ? "gniazdko" : pt.kind === "switch" ? "włącznik" : "punkt oświetlenia"} — wystaw w blacie / przesuń.`));
    }
  }

  out.push(...zoneIssues(room, items));
  out.push(...cornerIssues(room, items));
  return out;
}

/** Strefy robocze: zlew przy wodzie i odpływie, zmywarka obok zlewu, płyta przy gazie / 400 V, odstępy od ściany. */
function zoneIssues(room: Room, items: Placed[]): Issue[] {
  const out: Issue[] = [];
  const REACH = 400;
  for (const p of items) {
    const role = roleOf(p);
    if (!role) continue;
    const wall = room.walls.find((w) => w.id === p.wall);
    if (!wall) continue;
    const d = dimsOf(p, wall);
    if (!d) continue;
    const mk = (level: Issue["level"], code: string, msg: string): Issue => ({ level, code, msg, uid: p.uid, wall: wall.id });
    const pts = (k: ServicePoint["kind"][]) => wall.points.filter((pt) => k.includes(pt.kind));

    if (role === "sink" || role === "dishwasher") {
      const water = pts(["water_cold", "water_hot"]);
      const drain = pts(["drain"]);
      const label = role === "sink" ? "Zlew" : "Zmywarka";
      if (water.length === 0 && drain.length === 0) out.push(mk("info", "no_plumbing_marked", `${label}: na ścianie ${wall.label} nie ma zaznaczonej wody ani odpływu — dopisz punkty w skanie.`));
      else {
        if (!water.some((pt) => nearPoint(d, pt, REACH))) out.push(mk("warn", "water_far", `${label}: woda dalej niż ${REACH} mm od szafki.`));
        if (!drain.some((pt) => nearPoint(d, pt, REACH))) out.push(mk("warn", "drain_far", `${label}: odpływ dalej niż ${REACH} mm od szafki.`));
      }
    }
    if (role === "dishwasher") {
      const sink = items.find((o) => roleOf(o) === "sink" && o.wall === p.wall && (Math.abs(o.x - (p.x + p.w)) <= 60 || Math.abs(o.x + o.w - p.x) <= 60));
      if (!sink) out.push(mk("warn", "dishwasher_not_beside_sink", "Zmywarka nie stoi obok zlewu — dłuższe węże, gorsza ergonomia."));
    }
    if (role === "hob") {
      const gas = pts(["gas"]);
      const p400 = pts(["power_400"]);
      if (gas.length > 0 && !gas.some((pt) => nearPoint(d, pt, 500))) out.push(mk("warn", "gas_far", "Płyta: punkt gazu dalej niż 500 mm."));
      if (p400.length > 0 && !p400.some((pt) => nearPoint(d, pt, 600))) out.push(mk("warn", "power400_far", "Płyta: zasilanie 400 V dalej niż 600 mm."));
      if (gas.length === 0 && p400.length === 0) out.push(mk("info", "no_hob_supply", "Płyta: brak zaznaczonego gazu / 400 V w skanie."));
      // odstęp od ściany bocznej / słupka ≥ 300 mm (bezpieczeństwo, ręcznik, firanka)
      const talls = items.filter((o) => o.wall === p.wall && libById(o.libId)?.group === "tall");
      const left = Math.min(d.x0, ...talls.filter((o) => o.x + o.w <= d.x0 + 1).map((o) => d.x0 - (o.x + o.w)));
      const right = Math.min(wall.length_mm - d.x1, ...talls.filter((o) => o.x >= d.x1 - 1).map((o) => o.x - d.x1));
      if (left < 300 || right < 300) out.push(mk("warn", "hob_side_gap", "Płyta: mniej niż 300 mm do ściany lub słupka z boku."));
      for (const o of wall.obstacles) {
        if (o.kind === "window" && nearPoint(d, { id: "", kind: "other", x0: o.x0, x1: o.x1, z: 0 }, 300) && o.z0 < 1000)
          out.push(mk("warn", "hob_near_window", "Płyta przy oknie (< 300 mm) — firanka / przeciąg przy gazie."));
      }
    }
    if (role === "fridge" && pts(["socket"]).length > 0 && !pts(["socket"]).some((pt) => nearPoint(d, pt, 300)))
      out.push(mk("info", "fridge_socket", "Lodówka: brak gniazdka w pobliżu (300 mm)."));
  }
  return out;
}

/** Narożniki: uchwyty kolidujące w kącie, kąt ≠ 90° (klin do wypełnienia blendą). */
function cornerIssues(room: Room, items: Placed[]): Issue[] {
  const out: Issue[] = [];
  const n = room.walls.length;
  for (let i = 1; i <= (room.closed ? n : n - 1); i++) {
    const a = room.walls[(i - 1 + n) % n];
    const b = room.walls[i % n];
    const ang = b.corner_start_deg;
    if (ang != null && Math.abs(ang - 90) >= 1) {
      // klin przy narożniku dla szafki dolnej o głębokości 600: d·tan(|θ−90°|)
      const wedge = Math.round(600 * Math.tan((Math.abs(ang - 90) * Math.PI) / 180));
      out.push({ level: "warn", code: "corner_angle", msg: `Narożnik ${a.label}/${b.label}: ${ang}° zamiast 90° — klin ~${wedge} mm na głębokości 600; blenda skośna / docinka.`, wall: b.id });
    }
    for (const layer of ["low", "up"] as const) {
      const ia = items.find((p) => {
        const l = libById(p.libId);
        return p.wall === a.id && l && !l.corner && clash(layer, layerOf(l)) && p.x + p.w >= a.length_mm - 1;
      });
      const ib = items.find((p) => {
        const l = libById(p.libId);
        return p.wall === b.id && l && !l.corner && clash(layer, layerOf(l)) && p.x <= 1;
      });
      if (ia && ib) out.push({ level: "warn", code: "corner_handles", msg: `Narożnik ${a.label}/${b.label} (${layer === "low" ? "dół" : "góra"}): dwa fronty stykają się w kącie — dodaj blendę narożną ≥ 50 mm albo szafkę narożną.`, uid: ib.uid, wall: b.id });
    }
  }
  return out;
}

/** Wolne miejsce do wstawienia: pierwsze x, w które mieści się szafka (od lewej, przy sąsiadach). */
export function firstFit(room: Room, items: Placed[], libId: string, w: number, wallId: string, hint?: number): number | null {
  const wall = room.walls.find((s) => s.id === wallId);
  const lib = libById(libId);
  if (!wall || !lib) return null;
  const L = layerOf(lib);
  const edges = items.filter((o) => o.wall === wallId && clash(L, layerOf(libById(o.libId)!))).map((o) => o.x + o.w);
  const r = reserve(room, items, wall.index, L);
  const cands = hint != null ? [Math.max(0, Math.min(wall.length_mm - w, hint - w / 2))] : [r.start, 0, ...edges, wall.length_mm - w - r.end, wall.length_mm - w];
  if (lib.corner && hint == null) cands.unshift(wall.length_mm - w, 0);
  return cands.sort((a, b) => a - b).find((x) => fits(room, items, libId, w, x, wallId)) ?? null;
}
