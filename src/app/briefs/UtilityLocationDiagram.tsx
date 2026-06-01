"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Wall = "a" | "b" | "c" | "d";
type Layout = "lin" | "l" | "u" | "wneka" | "kwadrat" | "kwadrat_pol";

export type UtilityField = {
  // Klucz w zapisie briefu (data.{key}). Konwencja:
  //   {utility}_offset_mm, {utility}_height_mm, {utility}_width_mm,
  //   {utility}_occupied_height_mm, {utility}_depth_mm, ...
  key: string;
  label: string;
  help?: string;
  placeholder?: string;
  // Czy wartość bierze udział w rysowaniu markera? (offset/height/width/occupied_height)
  // Dla "depth_mm" itp. = false → renderujemy tylko input bez wpływu na rysunek.
  role?: "offset" | "height" | "width" | "occupied_height" | "extra";
};

export type UtilityDef = {
  key: string;
  label: string;
  color: string;
  fields: UtilityField[];
};

type UtilityState = {
  wall: Wall | "";
  offsetMm: number;
  heightMm: number;
  widthMm: number;
  occupiedHeightMm: number;
};

type RoomState = {
  layout: Layout;
  wallAMm: number;
  wallBMm: number;
  wallCMm: number;
  wallDMm: number;
  ceilingMm: number;
};

const DEFAULT_ROOM: RoomState = {
  layout: "u",
  wallAMm: 2500,
  wallBMm: 3000,
  wallCMm: 2500,
  wallDMm: 3000,
  ceilingMm: 2600,
};

const WALL_LABELS: Record<Wall, string> = {
  a: "Ściana A",
  b: "Ściana B",
  c: "Ściana C",
  d: "Ściana D",
};

function parseNum(raw: string): number {
  const s = raw.trim().replace(/\s+/g, "");
  let n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) {
    // Pole wymiaru może zawierać zakres "3000-3200" — bierzemy środek,
    // tak samo jak RoomMiniDiagram, zamiast cicho spadać do wartości domyślnej.
    const range = s.match(/^(\d+(?:[.,]\d+)?)[-–—](\d+(?:[.,]\d+)?)$/);
    if (range) {
      const a = Number(range[1].replace(",", "."));
      const b = Number(range[2].replace(",", "."));
      if (Number.isFinite(a) && Number.isFinite(b)) n = (a + b) / 2;
    }
  }
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 20000) return 20000;
  return n;
}

function numFromForm(form: HTMLFormElement, name: string): number {
  const el = form.querySelector<HTMLInputElement>(`input[name="data.${name}"]`);
  if (!el) return 0;
  return parseNum(el.value);
}

function tickStep(maxMm: number): number {
  if (maxMm <= 3500) return 500;
  if (maxMm <= 7000) return 1000;
  if (maxMm <= 15000) return 2500;
  return 5000;
}

function radio(form: HTMLFormElement, name: string): string {
  const el = form.querySelector<HTMLInputElement>(
    `input[name="data.${name}"]:checked`
  );
  return el?.value ?? "";
}

type InitialValue = string | number | boolean | number[] | null | undefined;
type InitialData = Record<string, InitialValue>;

function initialString(v: InitialValue): string {
  if (v === null || v === undefined || typeof v === "boolean" || Array.isArray(v)) {
    return "";
  }
  return String(v);
}

export default function UtilityLocationDiagram({
  utilities,
  initialData,
}: {
  utilities: UtilityDef[];
  initialData?: InitialData;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<RoomState>(DEFAULT_ROOM);

  // Przypisanie utility → ściana. Czytane z formularza (radio data.{u}_wall).
  const [walls, setWalls] = useState<Record<string, Wall | "">>(() => {
    const init: Record<string, Wall | ""> = {};
    for (const u of utilities) {
      const v = initialData?.[`${u.key}_wall`];
      init[u.key] = v === "a" || v === "b" || v === "c" || v === "d" ? v : "";
    }
    return init;
  });

  // Wartości liczbowe wszystkich pól mediów — kontrolowane,
  // żeby DOM mógł je przenosić między sekcjami ścian bez utraty wpisanych danych.
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const u of utilities) {
      for (const f of u.fields ?? []) {
        init[f.key] = initialString(initialData?.[f.key]);
      }
    }
    return init;
  });

  // Sync z formularza: wymiary pomieszczenia + radio przypisania ścian.
  // (Wartości liczbowe są zarządzane lokalnie — formularz je zobaczy przy submit
  // bo inputy mają name="data.{...}".)
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const layoutRaw = radio(form, "room_layout");
      const layout: Layout =
        layoutRaw === "lin" ||
        layoutRaw === "l" ||
        layoutRaw === "u" ||
        layoutRaw === "wneka" ||
        layoutRaw === "kwadrat" ||
        layoutRaw === "kwadrat_pol"
          ? layoutRaw
          : "u";
      const wA = numFromForm(form, "wall_a_mm") || DEFAULT_ROOM.wallAMm;
      const wB = numFromForm(form, "wall_b_mm") || DEFAULT_ROOM.wallBMm;
      const wC = numFromForm(form, "wall_c_mm") || DEFAULT_ROOM.wallCMm;
      const wD = numFromForm(form, "wall_d_mm") || DEFAULT_ROOM.wallDMm;
      const ceil = numFromForm(form, "ceiling_mm") || DEFAULT_ROOM.ceilingMm;
      setRoom((prev) => {
        if (
          prev.layout === layout &&
          prev.wallAMm === wA &&
          prev.wallBMm === wB &&
          prev.wallCMm === wC &&
          prev.wallDMm === wD &&
          prev.ceilingMm === ceil
        ) {
          return prev;
        }
        return {
          layout,
          wallAMm: wA,
          wallBMm: wB,
          wallCMm: wC,
          wallDMm: wD,
          ceilingMm: ceil,
        };
      });
      setWalls((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const u of utilities) {
          const w = radio(form, `${u.key}_wall`);
          const wv: Wall | "" =
            w === "a" || w === "b" || w === "c" || w === "d" ? w : "";
          if (next[u.key] !== wv) {
            next[u.key] = wv;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [utilities]);

  const states: Record<string, UtilityState> = useMemo(() => {
    const out: Record<string, UtilityState> = {};
    for (const u of utilities) {
      const get = (role: UtilityField["role"]): number => {
        const f = (u.fields ?? []).find((x) => x.role === role);
        if (!f) return 0;
        return parseNum(vals[f.key] ?? "");
      };
      out[u.key] = {
        wall: walls[u.key] ?? "",
        offsetMm: get("offset"),
        heightMm: get("height"),
        widthMm: get("width"),
        occupiedHeightMm: get("occupied_height"),
      };
    }
    return out;
  }, [utilities, walls, vals]);

  const showB = room.layout !== "lin";
  const showC =
    room.layout === "u" ||
    room.layout === "wneka" ||
    room.layout === "kwadrat" ||
    room.layout === "kwadrat_pol";
  const showD = room.layout === "kwadrat" || room.layout === "kwadrat_pol";

  const wallList: { id: Wall; lenMm: number }[] = [
    { id: "a", lenMm: room.wallAMm },
    ...(showB ? [{ id: "b" as Wall, lenMm: room.wallBMm }] : []),
    ...(showC ? [{ id: "c" as Wall, lenMm: room.wallCMm }] : []),
    ...(showD ? [{ id: "d" as Wall, lenMm: room.wallDMm }] : []),
  ];

  const unassigned = utilities.filter((u) => !walls[u.key]);

  const onValChange = (key: string, value: string) =>
    setVals((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));

  return (
    <div ref={ref} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-800">
          Rozwinięcie ścian — przyłącza
        </p>
        <p className="text-[11px] text-zinc-500">widok od wewnątrz</p>
      </div>

      <div className="flex flex-col gap-5">
        {wallList.map((w) => {
          const wallUtilities = utilities.filter(
            (u) => walls[u.key] === w.id
          );
          return (
            <WallSection
              key={w.id}
              wallId={w.id}
              wallLenMm={w.lenMm}
              ceilingMm={room.ceilingMm}
              utilities={utilities}
              states={states}
              wallUtilities={wallUtilities}
              vals={vals}
              onValChange={onValChange}
            />
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="mt-5 rounded-lg border border-dashed border-zinc-300 bg-white p-3">
          <p className="text-xs font-semibold text-zinc-700 mb-2">
            Nieprzypisane do ściany
          </p>
          <p className="text-[11px] text-zinc-500 mb-2">
            Wybierz ścianę powyżej w polu „… — ściana”, a pola wymiarów
            pojawią się pod właściwą ścianą.
          </p>
          <div className="flex flex-col gap-3">
            {unassigned.map((u) => (
              <UtilityInputs
                key={u.key}
                utility={u}
                vals={vals}
                onValChange={onValChange}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-zinc-200 pt-3">
        <p className="text-[11px] text-zinc-500 mb-2">Legenda</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {utilities.map((u) => {
            const s = states[u.key];
            const placed = s && s.wall !== "";
            return (
              <div
                key={u.key}
                className="flex items-center gap-2 text-xs"
                style={{ opacity: placed ? 1 : 0.45 }}
              >
                <span
                  className="inline-block rounded-sm shrink-0"
                  style={{ width: 14, height: 14, background: u.color }}
                />
                <span className="text-zinc-800 font-medium">{u.label}</span>
                {placed && (
                  <span className="text-zinc-500 tabular-nums">
                    {s.wall.toUpperCase()} · ↔{s.offsetMm} · ↕{s.heightMm}
                    {s.widthMm > 0 && ` · ⇔${s.widthMm}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WallSection({
  wallId,
  wallLenMm,
  ceilingMm,
  utilities,
  states,
  wallUtilities,
  vals,
  onValChange,
}: {
  wallId: Wall;
  wallLenMm: number;
  ceilingMm: number;
  utilities: UtilityDef[];
  states: Record<string, UtilityState>;
  wallUtilities: UtilityDef[];
  vals: Record<string, string>;
  onValChange: (key: string, value: string) => void;
}) {
  const safeLen = wallLenMm > 0 ? wallLenMm : 1;
  const safeH = ceilingMm > 0 ? ceilingMm : 1;

  const MAX_W = 300;
  const MAX_H = 200;
  const scale = Math.min(MAX_W / safeLen, MAX_H / safeH);
  const WW = scale * safeLen;
  const WH = scale * safeH;
  const WX = 42;
  const WY = 24;
  const VB_W = 360;
  const VB_H = WY + WH + 54;
  const FLOOR_Y = WY + WH;

  const onWall = utilities.filter((u) => states[u.key]?.wall === wallId);

  const markerOffsetXs = onWall.map((u) => {
    const s = states[u.key];
    const clOffset = Math.max(0, Math.min(s.offsetMm, safeLen));
    return WX + (clOffset / safeLen) * WW;
  });
  const endX = WX + WW;
  const tickLabelTooClose = (x: number): boolean => {
    if (Math.abs(x - endX) < 30) return true;
    return markerOffsetXs.some((mx) => Math.abs(x - mx) < 28);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-base font-bold text-zinc-900">
          {WALL_LABELS[wallId]}
        </span>
        <span className="text-zinc-500 tabular-nums">
          szer.{" "}
          <span className="text-zinc-800 font-semibold">{wallLenMm}</span> mm ·
          wys.{" "}
          <span className="text-zinc-800 font-semibold">{ceilingMm}</span> mm
        </span>
      </div>
      <div className="rounded-lg bg-white border border-zinc-200 p-2">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full block"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect
            x={WX}
            y={WY}
            width={WW}
            height={WH}
            fill="#fafaf9"
            stroke="#282624"
            strokeWidth="1.8"
          />

          <text
            x={WX + WW + 4}
            y={WY + 4}
            fontSize="10"
            fill="#52525b"
            fontWeight="600"
          >
            sufit
          </text>
          <text x={WX + WW + 4} y={WY + 15} fontSize="9" fill="#71717a">
            {ceilingMm}
          </text>

          {(() => {
            const step = tickStep(ceilingMm);
            const count = Math.min(Math.floor(ceilingMm / step), 12);
            return Array.from({ length: count }, (_, i) => {
              const h = (i + 1) * step;
              if (h >= ceilingMm) return null;
              const y = FLOOR_Y - (h / safeH) * WH;
              return (
                <g key={`tick-${h}`}>
                  <line
                    x1={WX - 6}
                    y1={y}
                    x2={WX}
                    y2={y}
                    stroke="#71717a"
                    strokeWidth={0.8}
                  />
                  <text
                    x={WX - 8}
                    y={y + 3}
                    fontSize="9"
                    fill="#71717a"
                    textAnchor="end"
                  >
                    {h}
                  </text>
                </g>
              );
            });
          })()}

          <line
            x1={WX - 8}
            y1={FLOOR_Y}
            x2={WX + WW + 8}
            y2={FLOOR_Y}
            stroke="#282624"
            strokeWidth="1.4"
          />
          <text
            x={WX - 10}
            y={FLOOR_Y + 3}
            fontSize="9"
            fill="#71717a"
            textAnchor="end"
          >
            0
          </text>

          {(() => {
            const step = tickStep(wallLenMm);
            const count = Math.min(Math.floor(wallLenMm / step), 12);
            return Array.from({ length: count }, (_, i) => {
              const o = (i + 1) * step;
              if (o >= wallLenMm) return null;
              const x = WX + (o / safeLen) * WW;
              const hideLabel = tickLabelTooClose(x);
              return (
                <g key={`htick-${o}`}>
                  <line
                    x1={x}
                    y1={FLOOR_Y}
                    x2={x}
                    y2={FLOOR_Y + 6}
                    stroke="#71717a"
                    strokeWidth={0.8}
                  />
                  {!hideLabel && (
                    <text
                      x={x}
                      y={FLOOR_Y + 16}
                      fontSize="9"
                      fill="#71717a"
                      textAnchor="middle"
                    >
                      {o}
                    </text>
                  )}
                </g>
              );
            });
          })()}

          <text
            x={WX + WW}
            y={FLOOR_Y + 16}
            fontSize="10"
            fill="#282624"
            fontWeight="700"
            textAnchor="end"
          >
            {wallLenMm}
          </text>

          {onWall.map((u) => {
            const s = states[u.key];
            const clOffset = Math.max(0, Math.min(s.offsetMm, safeLen));
            const clHeight = Math.max(0, Math.min(s.heightMm, safeH));
            const cx = WX + (clOffset / safeLen) * WW;
            const mw = Math.max(
              (Math.min(s.widthMm, safeLen) / safeLen) * WW,
              6
            );
            const fieldMm = Math.max(0, Math.min(s.occupiedHeightMm, safeH));
            const mh = fieldMm > 0 ? Math.max((fieldMm / safeH) * WH, 6) : 10;
            const my = FLOOR_Y - (clHeight / safeH) * WH;
            const cxLineX = cx + mw / 2;
            const rectTop = my - mh / 2;
            const rectBot = my + mh / 2;

            const labelRightX = cx + mw + 4;
            const labelLeftX = cx - 4;
            const labelOnRight = labelRightX + 50 < WX + MAX_W + 16;
            const labelX = labelOnRight ? labelRightX : labelLeftX;
            const labelAnchor: "start" | "end" = labelOnRight ? "start" : "end";

            const lineH = 11;
            const linesCount = s.widthMm > 0 || fieldMm > 0 ? 2 : 1;
            const labelY = my - ((linesCount - 1) * lineH) / 2 + 3;

            const sizeStr =
              fieldMm > 0
                ? `${s.widthMm || "?"} × ${s.occupiedHeightMm}`
                : s.widthMm > 0
                  ? `⇔ ${s.widthMm}`
                  : "";

            return (
              <g key={u.key}>
                <line
                  x1={cxLineX}
                  y1={FLOOR_Y}
                  x2={cxLineX}
                  y2={rectBot}
                  stroke={u.color}
                  strokeWidth="1"
                  strokeDasharray="3 2"
                />
                <line
                  x1={WX}
                  y1={my}
                  x2={cx}
                  y2={my}
                  stroke={u.color}
                  strokeWidth="0.6"
                  strokeDasharray="2 3"
                  opacity="0.35"
                />
                <rect
                  x={cx}
                  y={rectTop}
                  width={mw}
                  height={mh}
                  fill={u.color}
                  stroke="#282624"
                  strokeWidth="0.6"
                  rx="1.5"
                />
                <text
                  x={labelX}
                  y={labelY}
                  fontSize="10"
                  fill={u.color}
                  fontWeight="800"
                  textAnchor={labelAnchor}
                >
                  <tspan x={labelX}>↕ {s.heightMm}</tspan>
                  {sizeStr && (
                    <tspan x={labelX} dy={lineH} fontSize="9" fontWeight="700">
                      {sizeStr}
                    </tspan>
                  )}
                </text>
                <line
                  x1={cx}
                  y1={FLOOR_Y}
                  x2={cx}
                  y2={FLOOR_Y + 22}
                  stroke={u.color}
                  strokeWidth="0.9"
                />
                <text
                  x={cx}
                  y={FLOOR_Y + 34}
                  fontSize="10"
                  fill={u.color}
                  textAnchor="middle"
                  fontWeight="800"
                >
                  ↔ {s.offsetMm}
                </text>
              </g>
            );
          })}

          {onWall.length === 0 && (
            <text
              x={WX + WW / 2}
              y={WY + WH / 2 + 3}
              fontSize="11"
              fill="#d4d4d8"
              textAnchor="middle"
              fontStyle="italic"
            >
              brak przyłączy na tej ścianie
            </text>
          )}
        </svg>
      </div>

      {wallUtilities.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          {wallUtilities.map((u) => (
            <UtilityInputs
              key={u.key}
              utility={u}
              vals={vals}
              onValChange={onValChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UtilityInputs({
  utility,
  vals,
  onValChange,
}: {
  utility: UtilityDef;
  vals: Record<string, string>;
  onValChange: (key: string, value: string) => void;
}) {
  return (
    <div
      className="rounded-lg border border-zinc-200 bg-white p-2.5"
      style={{ borderLeft: `4px solid ${utility.color}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block rounded-sm"
          style={{ width: 10, height: 10, background: utility.color }}
        />
        <span className="text-xs font-semibold text-zinc-800">
          {utility.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(utility.fields ?? []).map((f) => {
          const name = `data.${f.key}`;
          const value = vals[f.key] ?? "";
          return (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-zinc-700 leading-tight">
                {f.label}
              </span>
              <input
                name={name}
                inputMode="decimal"
                value={value}
                onChange={(e) => onValChange(f.key, e.target.value)}
                placeholder={f.placeholder ?? "mm"}
                className="rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent w-full"
              />
              {f.help && (
                <span className="text-[10px] text-zinc-500 leading-snug">
                  {f.help}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
