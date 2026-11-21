// Testy silnika Projektanta kuchni (src/lib/kitchen) na syntetycznym skanie. Uruchom: npm run test:kitchen
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const lib = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "luviano-kitchen-"));
fs.writeFileSync(path.join(out, "package.json"), '{"type":"commonjs"}');
for (const f of ["scan2d", "cabinetLibrary", "cabinetPricing", "dao/room_scans.types", "kitchen/types", "kitchen/room", "kitchen/rules", "kitchen/hardware", "kitchen/quote", "kitchen/materials"]) {
  const js = ts.transpileModule(fs.readFileSync(path.join(lib, `${f}.ts`), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  fs.writeFileSync(path.join(out, `${f}.js`), js);
}
const { roomFromScan, applyOverrides } = require(path.join(out, "kitchen/room.js"));
const { checkProject, fits, firstFit } = require(path.join(out, "kitchen/rules.js"));
const { quoteKitchen } = require(path.join(out, "kitchen/quote.js"));
const { kitchenMaterialLines, KITCHEN_SOURCE_PREFIX } = require(path.join(out, "kitchen/materials.js"));
const { DEFAULT_RATES } = require(path.join(out, "cabinetPricing.js"));

// Pokój L: ściana A (0,0)→(3600,0), ściana B (3600,0)→(3600,2400); sufit 2600; okno na A 1500–2300, parapet 900.
const scan = {
  version: 1,
  scanned_at: "2026-11-21",
  closed: false,
  room_height_mm: 2600,
  walls: [
    { id: "a", x1: 0, y1: 0, x2: 3600, y2: 0, length_mm: 3600, height_mm: 2600, curve: { length_bottom: 3590, length_middle: 3596, length_top: 3600 } },
    { id: "b", x1: 3600, y1: 0, x2: 3600, y2: 2400, length_mm: 2400, height_mm: 2600 },
  ],
  openings: [{ id: "o1", kind: "window", wall_id: "a", x1: 1500, y1: 0, x2: 2300, y2: 0, width_mm: 800, height_mm: 1200, sill_mm: 900 }],
  objects: [],
  markers: [
    { id: "m1", kind: "drain", wall_id: "a", offset_mm: 600, height_mm: 450 },
    { id: "m2", kind: "water_cold", wall_id: "a", offset_mm: 600, height_mm: 550 },
  ],
  features: [{ id: "f1", kind: "radiator", wall_id: "b", offset_mm: 1000, elevation_mm: 200, width_mm: 800, height_mm: 600, depth_mm: 80 }],
};
const room = roomFromScan(scan);
const P = (libId, x, w, wall = "a", extra = {}) => ({ uid: `${libId}@${wall}${x}`, libId, wall, x, w, ...extra });
const codes = (iss) => iss.map((i) => i.code);

test("ściana krzywa: bierzemy najmniejszy pomiar z dalmierza", () => {
  assert.equal(room.walls[0].length_mm, 3590);
  assert.equal(room.walls[0].length_dev_mm, 10);
  assert.equal(room.walls[0].source, "dalmierz");
  assert.equal(room.walls[1].source, "lidar");
});

test("kąt narożnika B = 90°, okno i grzejnik trafiają jako przeszkody", () => {
  assert.equal(room.walls[1].corner_start_deg, 90);
  assert.ok(room.walls[0].obstacles.some((o) => o.kind === "window" && o.x0 === 1500 && o.z0 === 900));
  assert.ok(room.walls[1].obstacles.some((o) => o.kind === "radiator" && o.depth_mm === 80));
});

test("ręczna korekta wymiaru wygrywa ze skanem", () => {
  const r = applyOverrides(room, { a: { length_mm: 3620 } });
  assert.equal(r.walls[0].length_mm, 3620);
});

test("górna szafka pod oknem i dolna z odpływem za szufladami = błędy", () => {
  const iss = checkProject(room, [P("gor-600", 1600, 600), P("dol-szuf3-600", 300, 600)]);
  assert.ok(codes(iss).includes("window_collision"));
  assert.ok(codes(iss).includes("plumbing_behind"));
  assert.equal(iss.find((i) => i.code === "plumbing_behind").level, "error");
});

test("okno poniżej blatu blokuje dolną szafkę", () => {
  const iss = checkProject(room, [P("dol-drzwi-600", 1600, 600)]);
  assert.ok(codes(iss).includes("window_sill_low"));
});

test("zlew przy wodzie i odpływie — bez ostrzeżeń o strefie", () => {
  const iss = checkProject(room, [P("zlew-600", 300, 600)]);
  assert.ok(!codes(iss).includes("water_far") && !codes(iss).includes("drain_far"));
  const far = checkProject(room, [P("zlew-600", 2800, 600)]);
  assert.ok(codes(far).includes("water_far") && codes(far).includes("drain_far"));
});

test("grzejnik: szafka dolna na ścianie B ostrzega", () => {
  assert.ok(codes(checkProject(room, [P("dol-drzwi-600", 1000, 600, "b")])).includes("radiator_collision"));
});

test("narożna z drugiej ściany rezerwuje pas; zwykła tam nie wejdzie", () => {
  const corner = P("nar-dol-l-900", 2700, 900, "a");
  assert.ok(!fits(room, [corner], "dol-drzwi-600", 600, 0, "b"));
  assert.ok(fits(room, [corner], "dol-drzwi-600", 600, 900, "b"));
});

test("blendę narożną podpowiada się, gdy fronty schodzą się w kącie", () => {
  const iss = checkProject(room, [P("dol-drzwi-600", 2990, 600, "a"), P("dol-drzwi-600", 0, 600, "b")]);
  assert.ok(codes(iss).includes("corner_handles"));
});

test("wycena: ta sama funkcja co cennik, cena > koszt, okucia policzone", () => {
  const project = { version: 2, scan_id: null, fronts: "ordered", overrides: {}, margin_pct: null, items: [P("dol-drzwi-600", 0, 600), P("klapa-600", 0, 600)] };
  const q = quoteKitchen(room, project, DEFAULT_RATES);
  assert.ok(q.estimate.price > q.estimate.cost && q.estimate.cost > 0);
  assert.ok(q.snapshot.hardware.some((l) => l.key === "hinge-110"));
  assert.ok(q.snapshot.hardware.some((l) => l.key.startsWith("aventos-")));
  assert.equal(q.snapshot.worktop_mb, 0.6);
});

test("firstFit znajduje wolne miejsce po sąsiedzie", () => {
  assert.equal(firstFit(room, [P("dol-drzwi-600", 0, 600)], "dol-drzwi-600", 600, "a"), 600);
});

test("job_materials: suma linii = koszt wyceny, klucze kuchnia:*, grupy zgodne z wyceną", () => {
  const items = [P("dol-drzwi-600", 0, 600), P("dol-szuf3-600", 600, 600), P("gor-600", 0, 600), P("klapa-600", 0, 600), P("slup-600-piek", 1200, 600)];
  for (const fronts of ["ordered", "laminate"]) {
    const q = quoteKitchen(room, { version: 2, scan_id: null, fronts, overrides: {}, margin_pct: null, items }, DEFAULT_RATES);
    const lines = kitchenMaterialLines(q.estimate, DEFAULT_RATES, fronts);
    const sum = lines.reduce((s, l) => s + l.qty * l.unit_price_gross, 0);
    assert.ok(Math.abs(sum - q.estimate.cost) < 0.5, `${fronts}: ${sum} vs ${q.estimate.cost}`);
    assert.ok(lines.every((l) => l.auto_source.startsWith(KITCHEN_SOURCE_PREFIX)));
    assert.equal(new Set(lines.map((l) => l.auto_source)).size, lines.length);
  }
});

test("pusty projekt = brak linii (reconcile wyczyści stare)", () => {
  const q = quoteKitchen(room, { version: 2, scan_id: null, fronts: "ordered", overrides: {}, margin_pct: null, items: [] }, DEFAULT_RATES);
  assert.deepEqual(kitchenMaterialLines(q.estimate, DEFAULT_RATES, "ordered"), []);
});
