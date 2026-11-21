"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { fmtPLN } from "@/lib/format";
import type { FrontType, Rates } from "@/lib/cabinetPricing";
import { LIB_GROUP_LABELS, libByGroup, libById, type LibCab, type LibGroup } from "@/lib/cabinetLibrary";
import { markerKind } from "@/lib/scan2d";
import { applyOverrides, manualRoom } from "@/lib/kitchen/room";
import { AVENTOS_LABELS, defaultAventos } from "@/lib/kitchen/hardware";
import { quoteKitchen } from "@/lib/kitchen/quote";
import { checkProject, dimsOf, firstFit, fits, PLINTH, WORKTOP_TOP } from "@/lib/kitchen/rules";
import type { AventosKind, Issue, KitchenProject, Obstacle, Placed, Room } from "@/lib/kitchen/types";
import { saveKitchenAction } from "./actions";

const SNAP = 40;
const STORE = "luviano.projektant.v3";
const uid = () => Math.random().toString(36).slice(2, 9);

const EMPTY: KitchenProject = {
  version: 2,
  scan_id: null,
  fronts: "ordered",
  items: [],
  overrides: {},
  margin_pct: null,
  manual_walls: [{ id: "A", length_mm: 3600, height_mm: 2600 }],
};

const OBSTACLE_STYLE: Record<Obstacle["kind"], { fill: string; stroke: string }> = {
  window: { fill: "#dbe9f3", stroke: "#7aa7c7" },
  door: { fill: "#e8dccb", stroke: "#a98b62" },
  opening: { fill: "#ece9e2", stroke: "#b9b5ad" },
  sill: { fill: "#c9c5bc", stroke: "#8a867f" },
  radiator: { fill: "#f6d9d2", stroke: "#c0675a" },
  pipe: { fill: "#e1e1e1", stroke: "#8a867f" },
  fuse_box: { fill: "#f7e7b8", stroke: "#c8a02e" },
  riser: { fill: "#e1e1e1", stroke: "#8a867f" },
  beam: { fill: "#d6d2c8", stroke: "#8a867f" },
  box: { fill: "#e1e1e1", stroke: "#8a867f" },
};

const LEVEL_COLOR = { error: "#b3321d", warn: "#b8791b", info: "#6f6c66" } as const;

type Props = {
  rates: Rates;
  jobId: string | null;
  scanId: string | null;
  scanName: string | null;
  scanRoom: Room | null;
  saved: { id: string; project: KitchenProject } | null;
};

export default function KitchenDesigner({ rates, jobId, scanId, scanName, scanRoom, saved }: Props) {
  const [project, setProject] = useState<KitchenProject>(() => (saved ? saved.project : { ...EMPTY, scan_id: scanId }));
  const [projectId, setProjectId] = useState<string | null>(saved?.id ?? null);
  const [wallId, setWallId] = useState<string>(() => (scanRoom?.walls.find((w) => !w.planned) ?? scanRoom?.walls[0])?.id ?? "A");
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [libOpen, setLibOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [pending, start] = useTransition();
  const svgRef = useRef<SVGSVGElement>(null);
  const groups = useMemo(() => libByGroup(), []);

  // Tryb ręczny (bez zlecenia) pamięta szkic w przeglądarce; ze zleceniem źródłem jest baza.
  useEffect(() => {
    if (!jobId && !scanRoom) {
      try {
        const raw = localStorage.getItem(STORE);
        if (raw) {
          const s = JSON.parse(raw) as KitchenProject;
          // Odczyt szkicu z localStorage dopiero po montażu (SSR nie zna przeglądarki) — stąd setState w efekcie.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          if (s?.version === 2 && Array.isArray(s.items)) setProject({ ...EMPTY, ...s, items: s.items.filter((i) => libById(i.libId)) });
        }
      } catch {}
    }
    setReady(true);
  }, [jobId, scanRoom]);
  useEffect(() => {
    if (!ready || jobId || scanRoom) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(project));
    } catch {}
  }, [ready, project, jobId, scanRoom]);

  const room: Room = useMemo(() => {
    const base = scanRoom ?? manualRoom(project.manual_walls ?? EMPTY.manual_walls!);
    return applyOverrides(base, project.overrides);
  }, [scanRoom, project.manual_walls, project.overrides]);
  const wall = room.walls.find((w) => w.id === wallId) ?? room.walls[0];
  const items = project.items;
  const setItems = (f: (l: Placed[]) => Placed[]) => setProject((p) => ({ ...p, items: f(p.items) }));
  const patch = (id: string, f: (p: Placed) => Placed) => setItems((l) => l.map((p) => (p.uid === id ? f(p) : p)));

  const issues = useMemo(() => checkProject(room, items), [room, items]);
  const quote = useMemo(() => quoteKitchen(room, project, rates), [room, project, rates]);
  const allIssues: Issue[] = useMemo(() => [...issues, ...quote.hardwareIssues], [issues, quote.hardwareIssues]);
  const bad = useMemo(() => new Map(allIssues.filter((i) => i.uid).map((i) => [i.uid!, i.level] as const)), [allIssues]);
  const nErr = allIssues.filter((i) => i.level === "error").length;
  const nWarn = allIssues.filter((i) => i.level === "warn").length;

  const drag = useRef<{ id: string; dx: number } | null>(null);
  if (!wall) return <Card>Skan nie ma ścian — wróć do pomiaru.</Card>;
  const len = wall.length_mm;
  const H = Math.max(wall.height_mm, 1000);
  const here = items.filter((p) => p.wall === wall.id);
  const sy = (z: number) => H - z;

  function add(c: LibCab, atX?: number) {
    const x = firstFit(room, items, c.id, c.w, wall.id, atX);
    if (x == null) {
      setMsg("Brak miejsca na tej ścianie — zmień ścianę, wydłuż pomiar albo usuń szafkę.");
      return;
    }
    const p: Placed = { uid: uid(), libId: c.id, wall: wall.id, w: c.w, x };
    setItems((l) => [...l, p]);
    setSel(p.uid);
    setMsg("");
  }

  function setWidth(id: string, w: number) {
    const p = items.find((i) => i.uid === id);
    if (!p) return;
    const nw = Math.max(150, Math.min(1500, Math.round(w)));
    if (!fits(room, items.filter((i) => i.uid !== id), p.libId, nw, p.x, p.wall)) {
      setMsg("Ta szerokość nie mieści się — sąsiad, narożnik albo koniec ściany.");
      return;
    }
    setMsg("");
    patch(id, (q) => ({ ...q, w: nw }));
  }

  // ── przeciąganie ──
  const toMm = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * len;
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
    // przyciąganie do ścian, krawędzi sąsiadów i krawędzi przeszkód (okna, grzejniki)
    const edges = [
      0,
      len - p.w,
      ...rest.filter((o) => o.wall === p.wall).flatMap((o) => [o.x + o.w, o.x - p.w]),
      ...wall.obstacles.flatMap((o) => [o.x0 - p.w, o.x1]),
    ];
    const near = edges.reduce((b, c) => (Math.abs(c - x) < Math.abs(b - x) ? c : b), edges[0]);
    if (Math.abs(near - x) < SNAP) x = near;
    x = Math.max(0, Math.min(len - p.w, x));
    if (fits(room, rest, p.libId, p.w, x, p.wall)) patch(p.uid, (q) => ({ ...q, x }));
  }
  const onUp = () => {
    drag.current = null;
  };

  const selItem = items.find((i) => i.uid === sel);
  const selLib = selItem ? libById(selItem.libId) : undefined;
  const selDims = selItem ? dimsOf(selItem, wall) : null;
  const runLow = items.filter((p) => libById(p.libId)?.group !== "flap" && (libById(p.libId)?.elev ?? 0) === 0).reduce((s, p) => s + p.w, 0);
  const wallCurvy = wall.length_dev_mm >= 5 || wall.height_dev_mm >= 5;

  function save() {
    if (!jobId) return;
    start(async () => {
      const r = await saveKitchenAction(jobId, projectId, { ...project, scan_id: scanId });
      if (r.error) setMsg(r.error);
      else {
        if (r.id) setProjectId(r.id);
        setMsg(
          `Zapisano w zleceniu i w wycenie (${r.materials ?? 0} pozycji).` +
            (r.duplicates ? ` Uwaga: w tych grupach wyceny są też inne pozycje (${r.duplicates}) — sprawdź, czy nic się nie dubluje.` : "") +
            (r.errors ? ` Zostało ${r.errors} kolizji do poprawy.` : ""),
        );
      }
    });
  }

  return (
    <div className={`grid gap-4 ${libOpen ? "lg:grid-cols-[250px_1fr]" : ""}`}>
      {libOpen && (
        <Card className="max-h-[70vh] space-y-3 overflow-y-auto">
          <p className="text-[12px] text-[#6f6c66]">Dotknij szafkę albo przeciągnij na ścianę. Najczęściej używane są na górze.</p>
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
      )}

      <div className="min-w-0 space-y-3">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={() => setLibOpen((v) => !v)} className="rounded-lg border border-[#e3e1dc] px-3 py-1">
              {libOpen ? "Ukryj bibliotekę" : "Biblioteka"}
            </button>
            {room.walls.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWallId(w.id)}
                className={`rounded-lg border px-3 py-1 ${wall.id === w.id ? "border-[#a06f3f] bg-[#f4ece2] font-semibold" : "border-[#e3e1dc]"} ${w.planned ? "border-dashed" : ""}`}
              >
                {w.label}
                <span className="ml-1 text-[11px] text-[#8a867f]">{(w.length_mm / 1000).toFixed(2).replace(".", ",")} m</span>
              </button>
            ))}
            {!scanRoom && room.walls.length < 2 && (
              <button
                type="button"
                className="rounded-lg border border-dashed border-[#c9c5bc] px-3 py-1 text-[#6f6c66]"
                onClick={() => setProject((p) => ({ ...p, manual_walls: [...(p.manual_walls ?? []), { id: "B", length_mm: 2400, height_mm: 2600 }] }))}
              >
                + ściana B (układ L)
              </button>
            )}
            <label className="flex items-center gap-1">
              Długość
              <input
                type="number"
                inputMode="numeric"
                value={len}
                min={500}
                max={9000}
                onChange={(e) => {
                  const v = Math.max(500, Math.min(9000, Number(e.target.value) || len));
                  setProject((p) => ({ ...p, overrides: { ...p.overrides, [wall.id]: { ...p.overrides[wall.id], length_mm: v } } }));
                }}
                className="w-20 rounded-lg border border-[#e3e1dc] px-2 py-1 text-right"
              />
              mm
            </label>
            <label className="flex items-center gap-1">
              Wys.
              <input
                type="number"
                inputMode="numeric"
                value={wall.height_mm}
                min={1800}
                max={4000}
                onChange={(e) => {
                  const v = Math.max(1800, Math.min(4000, Number(e.target.value) || wall.height_mm));
                  setProject((p) => ({ ...p, overrides: { ...p.overrides, [wall.id]: { ...p.overrides[wall.id], height_mm: v } } }));
                }}
                className="w-16 rounded-lg border border-[#e3e1dc] px-2 py-1 text-right"
              />
            </label>
            <span className="text-[11px] text-[#8a867f]">
              {scanName ? `${scanName} · ` : ""}
              {wall.source === "dalmierz" ? "dalmierz 🔒" : "LiDAR ±2–5 cm"}
              {wall.corner_start_deg != null && Math.abs(wall.corner_start_deg - 90) >= 1 ? ` · kąt ${wall.corner_start_deg}°` : ""}
              {wallCurvy ? ` · krzywa ${Math.max(wall.length_dev_mm, wall.height_dev_mm)} mm` : ""}
            </span>
            <select
              value={project.fronts}
              onChange={(e) => setProject((p) => ({ ...p, fronts: e.target.value as FrontType }))}
              className="ml-auto rounded-lg border border-[#e3e1dc] px-2 py-1"
            >
              <option value="ordered">fronty zamawiane</option>
              <option value="laminate">fronty z płyty</option>
            </select>
            <button
              type="button"
              className="text-[13px] text-[#8a3b27]"
              onClick={() => {
                setItems((l) => l.filter((i) => i.wall !== wall.id));
                setSel(null);
              }}
            >
              Wyczyść ścianę
            </button>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${len} ${H}`}
            className="w-full touch-none rounded-lg bg-[#f2f2f1]"
            style={{ aspectRatio: `${len} / ${H}` }}
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
            <rect x={0} y={0} width={len} height={H} fill="#f7f6f3" />
            <rect x={0} y={sy(PLINTH)} width={len} height={PLINTH} fill="#dcdad5" />
            <line x1={0} x2={len} y1={sy(WORKTOP_TOP)} y2={sy(WORKTOP_TOP)} stroke="#d4d0c7" strokeWidth={3} strokeDasharray="30 20" />

            {wall.obstacles.map((o) => {
              const st = OBSTACLE_STYLE[o.kind];
              return (
                <g key={o.id} pointerEvents="none">
                  <rect x={o.x0} y={sy(o.z1)} width={o.x1 - o.x0} height={o.z1 - o.z0} fill={st.fill} stroke={st.stroke} strokeWidth={4} strokeDasharray={o.access ? "20 10" : undefined} />
                  <text x={(o.x0 + o.x1) / 2} y={sy((o.z0 + o.z1) / 2)} textAnchor="middle" fontSize={Math.min(50, (o.x1 - o.x0) / 5)} fill="#6f6c66">
                    {o.label}
                  </text>
                </g>
              );
            })}

            {here.map((p) => {
              const d = dimsOf(p, wall);
              const c = libById(p.libId);
              if (!d || !c) return null;
              const on = p.uid === sel;
              const lv = bad.get(p.uid);
              const fill = c.role === "sink" ? "#d9e6ee" : c.role === "hob" ? "#e9dcd0" : c.role === "dishwasher" ? "#e0e0e0" : c.group === "corner" ? "#efe3cf" : "#ffffff";
              const dr = c.drawers ?? 0;
              const h = d.z1 - d.z0;
              return (
                <g key={p.uid} onPointerDown={(e) => onDown(e, p)} style={{ cursor: "grab" }} opacity={0.96}>
                  <rect
                    x={p.x}
                    y={sy(d.z1)}
                    width={p.w}
                    height={h}
                    fill={fill}
                    stroke={on ? "#a06f3f" : lv === "error" ? LEVEL_COLOR.error : lv === "warn" ? LEVEL_COLOR.warn : "#8a867f"}
                    strokeWidth={on || lv === "error" ? 10 : 4}
                  />
                  {c.group !== "tall" &&
                    dr > 1 &&
                    Array.from({ length: dr - 1 }, (_, k) => (
                      <line key={k} x1={p.x} x2={p.x + p.w} y1={sy(d.z0 + ((k + 1) * h) / dr)} y2={sy(d.z0 + ((k + 1) * h) / dr)} stroke="#b9b5ad" strokeWidth={3} />
                    ))}
                  {(c.doors ?? 0) >= 2 && <line x1={p.x + p.w / 2} x2={p.x + p.w / 2} y1={sy(d.z1)} y2={sy(d.z0)} stroke="#b9b5ad" strokeWidth={3} />}
                  <text x={p.x + p.w / 2} y={sy(d.z0 + h / 2)} textAnchor="middle" fontSize={Math.min(70, p.w / 4.5)} fill="#6f6c66">
                    {p.w}
                  </text>
                </g>
              );
            })}

            {wall.points.map((pt) => {
              const k = markerKind(pt.kind);
              const cx = (pt.x0 + pt.x1) / 2;
              return (
                <g key={pt.id} pointerEvents="none">
                  {pt.x1 - pt.x0 > 1 && <rect x={pt.x0} y={sy(pt.z) - 20} width={pt.x1 - pt.x0} height={40} fill={k.color} opacity={0.25} />}
                  <circle cx={cx} cy={sy(pt.z)} r={34} fill="#fff" stroke={k.color} strokeWidth={8} />
                  <text x={cx} y={sy(pt.z) + 13} textAnchor="middle" fontSize={34} fontWeight={700} fill={k.color}>
                    {k.code}
                  </text>
                </g>
              );
            })}
          </svg>
          {msg && <p className="text-sm text-[#8a3b27]">{msg}</p>}
        </Card>

        {selItem && selLib && (
          <Card className="flex flex-wrap items-center gap-3 text-sm">
            <b>{selLib.name}</b>
            <label className="flex items-center gap-1">
              szer.
              <input
                type="number"
                inputMode="numeric"
                value={selItem.w}
                onChange={(e) => setWidth(selItem.uid, Number(e.target.value) || selItem.w)}
                className="w-20 rounded-lg border border-[#e3e1dc] px-2 py-1 text-right"
              />
              mm
            </label>
            {selDims && (
              <span className="text-[12px] text-[#8a867f]">
                wys. {Math.round(selDims.z1 - selDims.z0)} · od {Math.round(selDims.z0)} mm
              </span>
            )}
            {selLib.group !== "lower" && selLib.group !== "sink_app" && selLib.group !== "corner" && (
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!selItem.to_ceiling}
                  onChange={(e) => patch(selItem.uid, (q) => ({ ...q, to_ceiling: e.target.checked }))}
                />
                pod sufit
              </label>
            )}
            {selLib.kind === "upper_flap" && (
              <select
                value={selItem.aventos ?? defaultAventos(selLib.h, selItem.w)}
                onChange={(e) => patch(selItem.uid, (q) => ({ ...q, aventos: e.target.value as AventosKind }))}
                className="rounded-lg border border-[#e3e1dc] px-2 py-1"
              >
                {(Object.keys(AVENTOS_LABELS) as AventosKind[]).map((k) => (
                  <option key={k} value={k}>
                    {AVENTOS_LABELS[k]}
                  </option>
                ))}
              </select>
            )}
            {(selLib.drawers ?? 0) > 0 && (
              <select
                value={selItem.drawer_system ?? "merivobox"}
                onChange={(e) => patch(selItem.uid, (q) => ({ ...q, drawer_system: e.target.value as "merivobox" | "legrabox" }))}
                className="rounded-lg border border-[#e3e1dc] px-2 py-1"
              >
                <option value="merivobox">Merivobox</option>
                <option value="legrabox">Legrabox</option>
              </select>
            )}
            <button type="button" className="rounded-lg border border-[#e3e1dc] px-3 py-1" onClick={() => add(selLib)}>
              Powiel
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#ecccc0] px-3 py-1 text-[#8a3b27]"
              onClick={() => {
                setItems((l) => l.filter((i) => i.uid !== selItem.uid));
                setSel(null);
              }}
            >
              Usuń
            </button>
            <span className="ml-auto text-[#6f6c66]">{fmtPLN(quote.priceByUid[selItem.uid] ?? 0)}</span>
          </Card>
        )}

        {allIssues.length > 0 && (
          <Card className="space-y-1 text-sm">
            <details open={nErr > 0}>
              <summary className="cursor-pointer select-none">
                <b style={{ color: nErr ? LEVEL_COLOR.error : LEVEL_COLOR.warn }}>
                  {nErr > 0 ? `${nErr} kolizji` : "Brak kolizji"}
                </b>
                {nWarn > 0 && <span className="text-[#b8791b]"> · {nWarn} do sprawdzenia</span>}
              </summary>
              <ul className="mt-2 space-y-1">
                {[...allIssues]
                  .sort((a, b) => "error warn info".indexOf(a.level) - "error warn info".indexOf(b.level))
                  .map((i, k) => (
                    <li key={k}>
                      <button
                        type="button"
                        className="text-left text-[13px]"
                        style={{ color: LEVEL_COLOR[i.level] }}
                        onClick={() => {
                          if (i.wall) setWallId(i.wall);
                          if (i.uid) setSel(i.uid);
                        }}
                      >
                        {i.level === "error" ? "✕" : i.level === "warn" ? "!" : "i"} {i.msg}
                      </button>
                    </li>
                  ))}
              </ul>
            </details>
          </Card>
        )}

        <Card className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-[#6f6c66]">
              {items.length} szafek · dół {Math.round(runLow)} mm · blat {quote.snapshot.worktop_mb} mb · cokół {quote.snapshot.plinth_mb} mb · koszt {fmtPLN(quote.estimate.cost)}
            </span>
            <span className="text-xl font-semibold">{fmtPLN(quote.estimate.price)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#8a867f]">
            <label className="flex items-center gap-1">
              marża
              <input
                type="number"
                inputMode="numeric"
                value={project.margin_pct ?? rates.margin_pct}
                onChange={(e) => setProject((p) => ({ ...p, margin_pct: e.target.value === "" ? null : Number(e.target.value) }))}
                className="w-16 rounded-lg border border-[#e3e1dc] px-2 py-1 text-right"
              />
              %
            </label>
            <span>Brutto, z cennika szafek. Bez blatu, AGD i montażu.</span>
            {jobId ? (
              <button type="button" disabled={pending || items.length === 0} onClick={save} className="ml-auto rounded-lg bg-[#282624] px-4 py-2 text-sm text-white disabled:opacity-40">
                {pending ? "Zapisuję…" : projectId ? "Zapisz zmiany w zleceniu" : "Zapisz w zleceniu"}
              </button>
            ) : (
              <span className="ml-auto">Otwórz projektant ze zlecenia (?job=…), żeby zapisać projekt.</span>
            )}
          </div>
          {quote.snapshot.hardware.length > 0 && (
            <details className="text-[12px] text-[#6f6c66]">
              <summary className="cursor-pointer">Okucia do zamówienia ({quote.snapshot.hardware.reduce((s, l) => s + l.qty, 0)} szt.)</summary>
              <ul className="mt-1 space-y-0.5">
                {quote.snapshot.hardware.map((l) => (
                  <li key={l.key}>
                    {l.qty}× {l.name}
                    {l.note ? <span className="text-[#8a867f]"> — {l.note}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>
    </div>
  );
}
