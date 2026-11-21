"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { fmtPLN } from "@/lib/format";
import { estimate, type FrontType, type Rates } from "@/lib/cabinetPricing";
import { LIB_GROUP_LABELS, libByGroup, libById, libToCab, type LibCab, type LibGroup } from "@/lib/cabinetLibrary";

/** Szafka postawiona na ścianie. `x` = lewa krawędź od lewego narożnika (mm). */
type Placed = { uid: string; libId: string; w: number; x: number; wi: 0 | 1 };

const CEILING = 2600;
const PLINTH = 150;
const SNAP = 40;
const STORE = "luviano.projektant.v2";

type Layer = "low" | "up" | "both";
const layerOf = (c: LibCab): Layer => (c.group === "tall" ? "both" : c.elev > 0 ? "up" : "low");
const clash = (a: Layer, b: Layer) => a === "both" || b === "both" || a === b;

const uid = () => Math.random().toString(36).slice(2, 9);

export default function KitchenDesigner({ rates }: { rates: Rates }) {
  const [walls, setWalls] = useState<[number, number]>([3600, 0]);
  const [wi, setWi] = useState<0 | 1>(0);
  const [items, setItems] = useState<Placed[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [fronts, setFronts] = useState<FrontType>("ordered");
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const groups = useMemo(() => libByGroup(), []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.walls) && Number(s.walls[0]) > 0) setWalls([Number(s.walls[0]), Math.max(0, Number(s.walls[1]) || 0)]);
        if (Array.isArray(s.items)) setItems(s.items.filter((i: Placed) => libById(i.libId) && (i.wi === 0 || i.wi === 1)));
        if (s.fronts === "laminate" || s.fronts === "ordered") setFronts(s.fronts);
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ walls, items, fronts }));
    } catch {}
  }, [ready, walls, items, fronts]);

  const lib = (p: Placed) => libById(p.libId)!;
  const wall = walls[wi];
  /** Strefa zajęta przez narożną z drugiej ściany (głębokość kwadratu L) na początku / końcu tej ściany. */
  const reserve = (rest: Placed[], onWall: 0 | 1, L: Layer) => {
    const other = onWall === 0 ? 1 : 0;
    let r = 0;
    for (const o of rest) {
      const c = lib(o);
      if (o.wi !== other || !c.corner || !clash(L, layerOf(c))) continue;
      // narożna stoi w styku ścian: koniec A (x + w = długość A) albo początek B (x = 0)
      const atJoint = other === 0 ? o.x + o.w >= walls[0] - 1 : o.x <= 1;
      if (atJoint) r = Math.max(r, c.corner.armB);
    }
    return r;
  };
  const fits = (rest: Placed[], libId: string, w: number, x: number, onWall: 0 | 1 = wi) => {
    const c = libById(libId)!;
    const L = layerOf(c);
    const len = walls[onWall];
    if (x < -0.5 || x + w > len + 0.5) return false;
    if (!c.corner) {
      const r = reserve(rest, onWall, L);
      if (r > 0 && (onWall === 1 ? x < r - 0.5 : x + w > len - r + 0.5)) return false;
    }
    return !rest.some((o) => o.wi === onWall && clash(L, layerOf(lib(o))) && x < o.x + o.w - 0.5 && x + w > o.x + 0.5);
  };

  function add(c: LibCab, atX?: number) {
    const w = c.w;
    const L = layerOf(c);
    const same = items.filter((o) => o.wi === wi && clash(L, layerOf(lib(o))));
    // narożna: najpierw w styku ścian (koniec A / początek B), jeśli jest druga ściana
    const joint = c.corner && walls[1] > 0 ? [wi === 0 ? wall - w : 0] : [];
    const cands = atX != null ? [Math.max(0, Math.min(wall - w, atX - w / 2))] : [0, ...same.map((o) => o.x + o.w)];
    cands.sort((a, b) => a - b);
    if (atX == null) cands.unshift(...joint);
    const x = cands.find((cx) => fits(items, c.id, w, cx));
    if (x == null) {
      setMsg("Brak miejsca na tej ścianie — wydłuż ścianę albo usuń szafkę.");
      return;
    }
    const p: Placed = { uid: uid(), libId: c.id, w, x, wi };
    setItems([...items, p]);
    setSel(p.uid);
    setMsg("");
  }

  const patch = (id: string, f: (p: Placed) => Placed) => setItems((l) => l.map((p) => (p.uid === id ? f(p) : p)));

  function setWidth(id: string, w: number) {
    const p = items.find((i) => i.uid === id);
    if (!p) return;
    const nw = Math.max(150, Math.min(1500, Math.round(w)));
    if (!fits(items.filter((i) => i.uid !== id), p.libId, nw, p.x, p.wi)) {
      setMsg("Ta szerokość nie mieści się — sąsiad albo koniec ściany.");
      return;
    }
    setMsg("");
    patch(id, (q) => ({ ...q, w: nw }));
  }

  // ── przeciąganie szafki po ścianie ──
  const drag = useRef<{ id: string; dx: number } | null>(null);
  const toMm = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * wall;
  };
  function onDown(e: React.PointerEvent, p: Placed) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id: p.uid, dx: toMm(e.clientX) - p.x };
    setSel(p.uid);
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = items.find((i) => i.uid === d.id);
    if (!p) return;
    const rest = items.filter((i) => i.uid !== d.id);
    let x = toMm(e.clientX) - d.dx;
    // przyciąganie do ścian i krawędzi sąsiadów
    const edges = [0, wall - p.w, ...rest.flatMap((o) => (o.wi === p.wi && clash(layerOf(lib(p)), layerOf(lib(o))) ? [o.x + o.w, o.x - p.w] : []))];
    const near = edges.reduce((b, c) => (Math.abs(c - x) < Math.abs(b - x) ? c : b), edges[0]);
    if (Math.abs(near - x) < SNAP) x = near;
    x = Math.max(0, Math.min(wall - p.w, x));
    if (fits(rest, p.libId, p.w, x, p.wi)) patch(p.uid, (q) => ({ ...q, x }));
  }
  const onUp = () => {
    drag.current = null;
  };

  // ── wycena ──
  const est = useMemo(
    () => estimate(items.map((p) => libToCab(libById(p.libId)!, p.w)), {}, rates, { fronts }),
    [items, rates, fronts],
  );
  const selIdx = items.findIndex((i) => i.uid === sel);
  const selItem = selIdx >= 0 ? items[selIdx] : undefined;
  const selLib = selItem ? lib(selItem) : undefined;
  const here = items.filter((p) => p.wi === wi);
  const lows = here.filter((p) => layerOf(lib(p)) === "low");
  const runLow = items.filter((p) => layerOf(lib(p)) !== "up").reduce((s, p) => s + p.w, 0);
  const sy = (z: number) => CEILING - z;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="max-h-[70vh] space-y-3 overflow-y-auto">
        <p className="text-[12px] text-[#6f6c66]">Dotknij szafkę, żeby ją dodać (albo przeciągnij na ścianę). Najczęściej używane są na górze.</p>
        {(Object.keys(groups) as LibGroup[]).map((g) => (
          <div key={g}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6f6c66]">{LIB_GROUP_LABELS[g]}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {groups[g].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/lib", c.id)}
                  onClick={() => add(c)}
                  className="rounded-lg border border-[#e3e1dc] bg-white px-2 py-1.5 text-left text-[12px] leading-tight active:bg-[#f2f2f1]"
                >
                  {c.name}
                  <span className="block text-[10px] text-[#8a867f]">
                    {c.w}×{c.h}
                    {c.uses > 0 ? ` · ${c.uses}×` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <div className="space-y-3">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              {([0, 1] as const).map((i) =>
                i === 1 && walls[1] === 0 ? (
                  <button
                    key={i}
                    type="button"
                    className="rounded-lg border border-dashed border-[#c9c5bc] px-3 py-1 text-[#6f6c66]"
                    onClick={() => {
                      setWalls([walls[0], 2400]);
                      setWi(1);
                    }}
                  >
                    + ściana B (układ L)
                  </button>
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWi(i)}
                    className={`rounded-lg border px-3 py-1 ${wi === i ? "border-[#a06f3f] bg-[#f4ece2] font-semibold" : "border-[#e3e1dc]"}`}
                  >
                    Ściana {i === 0 ? "A" : "B"}
                  </button>
                ),
              )}
            </div>
            <label className="flex items-center gap-2">
              Długość (mm)
              <input
                type="number"
                inputMode="numeric"
                value={wall}
                min={1000}
                max={9000}
                onChange={(e) => {
                  const v = Math.max(1000, Math.min(9000, Number(e.target.value) || 3600));
                  setWalls(wi === 0 ? [v, walls[1]] : [walls[0], v]);
                }}
                className="w-24 rounded-lg border border-[#e3e1dc] px-2 py-1 text-right"
              />
            </label>
            {wi === 1 && (
              <button
                type="button"
                className="text-[13px] text-[#8a3b27]"
                onClick={() => {
                  setItems(items.filter((i) => i.wi !== 1));
                  setWalls([walls[0], 0]);
                  setWi(0);
                  setSel(null);
                }}
              >
                Usuń ścianę B
              </button>
            )}
            <label className="flex items-center gap-2">
              Fronty
              <select value={fronts} onChange={(e) => setFronts(e.target.value as FrontType)} className="rounded-lg border border-[#e3e1dc] px-2 py-1">
                <option value="ordered">zamawiane (lakier/akryl)</option>
                <option value="laminate">z płyty laminowanej</option>
              </select>
            </label>
            <button
              type="button"
              className="ml-auto text-[13px] text-[#8a3b27]"
              onClick={() => {
                setItems(items.filter((i) => i.wi !== wi));
                setSel(null);
              }}
            >
              Wyczyść ścianę
            </button>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${wall} ${CEILING}`}
            className="w-full touch-none rounded-lg bg-[#f2f2f1]"
            style={{ aspectRatio: `${wall} / ${CEILING}` }}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const c = libById(e.dataTransfer.getData("text/lib"));
              if (c) add(c, toMm(e.clientX));
            }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSel(null);
            }}
          >
            <rect x={0} y={0} width={wall} height={CEILING} fill="#f7f6f3" />
            <rect x={0} y={sy(PLINTH)} width={wall} height={PLINTH} fill="#dcdad5" />
            {here.map((p) => {
              const c = lib(p);
              const bottom = c.elev > 0 ? c.elev : PLINTH;
              const top = bottom + c.h;
              const on = p.uid === sel;
              const fill =
                c.role === "sink" ? "#d9e6ee" : c.role === "hob" ? "#e9dcd0" : c.role === "dishwasher" ? "#e0e0e0" : c.group === "corner" ? "#efe3cf" : "#ffffff";
              const dr = c.drawers ?? 0;
              return (
                <g key={p.uid} onPointerDown={(e) => onDown(e, p)} style={{ cursor: "grab" }}>
                  <rect x={p.x} y={sy(top)} width={p.w} height={c.h} fill={fill} stroke={on ? "#a06f3f" : "#8a867f"} strokeWidth={on ? 10 : 4} />
                  {c.group !== "tall" &&
                    dr > 1 &&
                    Array.from({ length: dr - 1 }, (_, k) => {
                      const y = sy(bottom + ((k + 1) * c.h) / dr);
                      return <line key={k} x1={p.x} x2={p.x + p.w} y1={y} y2={y} stroke="#b9b5ad" strokeWidth={3} />;
                    })}
                  {(c.doors ?? 0) >= 2 && <line x1={p.x + p.w / 2} x2={p.x + p.w / 2} y1={sy(top)} y2={sy(bottom)} stroke="#b9b5ad" strokeWidth={3} />}
                  <text x={p.x + p.w / 2} y={sy(top - c.h / 2)} textAnchor="middle" fontSize={Math.min(70, p.w / 4.5)} fill="#6f6c66">
                    {p.w}
                  </text>
                </g>
              );
            })}
            {([["low", PLINTH, 720 + 38], ["up", 1431, 640]] as const).map(([layer, z, h]) => {
              const r = reserve(items, wi, layer);
              if (r <= 0) return null;
              return <rect key={layer} x={wi === 1 ? 0 : wall - r} y={sy(z + h)} width={r} height={h} fill="#a06f3f" opacity={0.12} />;
            })}
            {lows.length > 0 && (
              <rect
                x={Math.min(...lows.map((p) => p.x))}
                y={sy(PLINTH + 720 + 38)}
                width={Math.max(...lows.map((p) => p.x + p.w)) - Math.min(...lows.map((p) => p.x))}
                height={38}
                fill="#6f6c66"
              />
            )}
          </svg>
          {msg && <p className="text-sm text-[#8a3b27]">{msg}</p>}
        </Card>

        {selItem && selLib && (
          <Card className="flex flex-wrap items-center gap-3 text-sm">
            <b>{selLib.name}</b>
            <label className="flex items-center gap-2">
              szerokość
              <input
                type="number"
                inputMode="numeric"
                value={selItem.w}
                onChange={(e) => setWidth(selItem.uid, Number(e.target.value) || selItem.w)}
                className="w-20 rounded-lg border border-[#e3e1dc] px-2 py-1 text-right"
              />
              mm
            </label>
            <button type="button" className="rounded-lg border border-[#e3e1dc] px-3 py-1" onClick={() => add(selLib)}>
              Powiel
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#ecccc0] px-3 py-1 text-[#8a3b27]"
              onClick={() => {
                setItems(items.filter((i) => i.uid !== selItem.uid));
                setSel(null);
              }}
            >
              Usuń
            </button>
            <span className="ml-auto text-[#6f6c66]">{fmtPLN(est.items[selIdx]?.price ?? 0)}</span>
          </Card>
        )}

        <Card className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[#6f6c66]">
              {items.length} szafek · dół {Math.round(runLow)} mm · koszt {fmtPLN(est.cost)}
            </span>
            <span className="text-xl font-semibold">{fmtPLN(est.price)}</span>
          </div>
          <p className="text-[11px] text-[#8a867f]">
            Cena brutto dla klienta z cennika szafek (marża {est.margin_pct}%). Bez blatu, AGD i montażu — to wycena samych szafek.
          </p>
        </Card>
      </div>
    </div>
  );
}
