"use client";

import { useEffect, useRef, useState } from "react";

type Wall = "a" | "b" | "c" | "d";
type Layout = "lin" | "l" | "u" | "wneka" | "kwadrat";

export type UtilityDef = {
  key: string;
  label: string;
  color: string;
};

type UtilityState = {
  wall: Wall | "";
  offsetMm: number;
  heightMm: number;
  widthMm: number;
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

function num(form: HTMLFormElement, name: string): number {
  const el = form.querySelector<HTMLInputElement>(`input[name="data.${name}"]`);
  if (!el) return 0;
  const n = Number(el.value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function radio(form: HTMLFormElement, name: string): string {
  const el = form.querySelector<HTMLInputElement>(
    `input[name="data.${name}"]:checked`
  );
  return el?.value ?? "";
}

export default function UtilityLocationDiagram({
  utilities,
}: {
  utilities: UtilityDef[];
}) {
  const [room, setRoom] = useState<RoomState>(DEFAULT_ROOM);
  const [states, setStates] = useState<Record<string, UtilityState>>({});
  const ref = useRef<HTMLDivElement>(null);

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
        layoutRaw === "kwadrat"
          ? layoutRaw
          : "u";
      setRoom({
        layout,
        wallAMm: num(form, "wall_a_mm") || DEFAULT_ROOM.wallAMm,
        wallBMm: num(form, "wall_b_mm") || DEFAULT_ROOM.wallBMm,
        wallCMm: num(form, "wall_c_mm") || DEFAULT_ROOM.wallCMm,
        wallDMm: num(form, "wall_d_mm") || DEFAULT_ROOM.wallDMm,
        ceilingMm: num(form, "ceiling_mm") || DEFAULT_ROOM.ceilingMm,
      });
      const next: Record<string, UtilityState> = {};
      for (const u of utilities) {
        const wallRaw = radio(form, `${u.key}_wall`);
        const wall: Wall | "" =
          wallRaw === "a" || wallRaw === "b" || wallRaw === "c" || wallRaw === "d" ? wallRaw : "";
        next[u.key] = {
          wall,
          offsetMm: num(form, `${u.key}_offset_mm`),
          heightMm: num(form, `${u.key}_height_mm`),
          widthMm: num(form, `${u.key}_width_mm`),
        };
      }
      setStates(next);
    };
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [utilities]);

  const showB = room.layout !== "lin";
  const showC = room.layout === "u" || room.layout === "wneka" || room.layout === "kwadrat";
  const showD = room.layout === "kwadrat";

  const walls: { id: Wall; lenMm: number }[] = [
    { id: "a", lenMm: room.wallAMm },
    ...(showB ? [{ id: "b" as Wall, lenMm: room.wallBMm }] : []),
    ...(showC ? [{ id: "c" as Wall, lenMm: room.wallCMm }] : []),
    ...(showD ? [{ id: "d" as Wall, lenMm: room.wallDMm }] : []),
  ];

  return (
    <div ref={ref} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-800">
          Rozwinięcie ścian
        </p>
        <p className="text-[11px] text-zinc-500">widok od wewnątrz</p>
      </div>

      <div className="flex flex-col gap-5">
        {walls.map((w) => (
          <WallElevation
            key={w.id}
            wallId={w.id}
            wallLenMm={w.lenMm}
            ceilingMm={room.ceilingMm}
            utilities={utilities}
            states={states}
          />
        ))}
      </div>

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

function WallElevation({
  wallId,
  wallLenMm,
  ceilingMm,
  utilities,
  states,
}: {
  wallId: Wall;
  wallLenMm: number;
  ceilingMm: number;
  utilities: UtilityDef[];
  states: Record<string, UtilityState>;
}) {
  // SVG geometry — sized larger so labels are legible
  const VB_W = 360;
  const VB_H = 210;
  const WX = 42;
  const WY = 32;
  const WW = 300;
  const WH = 140;
  const FLOOR_Y = WY + WH;

  const safeLen = wallLenMm > 0 ? wallLenMm : 1;
  const safeH = ceilingMm > 0 ? ceilingMm : 1;

  const onWall = utilities.filter((u) => states[u.key]?.wall === wallId);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-base font-bold text-zinc-900">
          Ściana {wallId.toUpperCase()}
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
          {/* Wall fill */}
          <rect
            x={WX}
            y={WY}
            width={WW}
            height={WH}
            fill="#fafaf9"
            stroke="#282624"
            strokeWidth="1.8"
          />

          {/* Ceiling line label */}
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

          {/* Vertical height axis ticks */}
          {Array.from({ length: Math.floor(ceilingMm / 500) }, (_, i) => {
            const h = (i + 1) * 500;
            if (h >= ceilingMm) return null;
            const y = FLOOR_Y - (h / safeH) * WH;
            const isMeter = h % 1000 === 0;
            return (
              <g key={`tick-${h}`}>
                <line
                  x1={WX - (isMeter ? 6 : 3)}
                  y1={y}
                  x2={WX}
                  y2={y}
                  stroke={isMeter ? "#71717a" : "#d4d4d8"}
                  strokeWidth={isMeter ? 0.8 : 0.5}
                />
                {isMeter && (
                  <text
                    x={WX - 8}
                    y={y + 3}
                    fontSize="9"
                    fill="#71717a"
                    textAnchor="end"
                  >
                    {h}
                  </text>
                )}
              </g>
            );
          })}

          {/* Floor */}
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

          {/* Horizontal axis ticks */}
          {Array.from({ length: Math.floor(wallLenMm / 500) }, (_, i) => {
            const o = (i + 1) * 500;
            if (o >= wallLenMm) return null;
            const x = WX + (o / safeLen) * WW;
            const isMeter = o % 1000 === 0;
            return (
              <g key={`htick-${o}`}>
                <line
                  x1={x}
                  y1={FLOOR_Y}
                  x2={x}
                  y2={FLOOR_Y + (isMeter ? 6 : 3)}
                  stroke={isMeter ? "#71717a" : "#d4d4d8"}
                  strokeWidth={isMeter ? 0.8 : 0.5}
                />
                {isMeter && (
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
          })}

          {/* End-of-wall label */}
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

          {/* Markers */}
          {onWall.map((u, i) => {
            const s = states[u.key];
            const clOffset = Math.max(0, Math.min(s.offsetMm, safeLen));
            const clHeight = Math.max(0, Math.min(s.heightMm, safeH));
            const cx = WX + (clOffset / safeLen) * WW;
            const mw = Math.max(
              (Math.min(s.widthMm, safeLen) / safeLen) * WW,
              6
            );
            const my = FLOOR_Y - (clHeight / safeH) * WH;
            const cxLineX = cx + mw / 2;
            // Label position alternates above/below to reduce overlap
            const labelAbove = i % 2 === 0;
            return (
              <g key={u.key}>
                {/* Horizontal extension from left edge */}
                <line
                  x1={WX}
                  y1={my}
                  x2={cx}
                  y2={my}
                  stroke={u.color}
                  strokeWidth="0.7"
                  strokeDasharray="2 2"
                  opacity="0.5"
                />
                {/* Vertical drop to floor */}
                <line
                  x1={cxLineX}
                  y1={FLOOR_Y}
                  x2={cxLineX}
                  y2={my}
                  stroke={u.color}
                  strokeWidth="1"
                  strokeDasharray="3 2"
                />
                {/* Marker rectangle */}
                <rect
                  x={cx}
                  y={my - 5}
                  width={mw}
                  height={10}
                  fill={u.color}
                  stroke="#282624"
                  strokeWidth="0.6"
                  rx="1.5"
                />
                {/* Height label */}
                <text
                  x={cx + mw + 4}
                  y={my + 3.5}
                  fontSize="10"
                  fill={u.color}
                  fontWeight="800"
                >
                  ↕{s.heightMm}
                </text>
                {/* Width label */}
                {s.widthMm > 0 && (
                  <text
                    x={cxLineX}
                    y={labelAbove ? my - 8 : my + 14}
                    fontSize="9"
                    fill={u.color}
                    textAnchor="middle"
                    fontWeight="700"
                  >
                    ⇔{s.widthMm}
                  </text>
                )}
                {/* Offset value at floor */}
                <text
                  x={cxLineX}
                  y={FLOOR_Y + 27}
                  fontSize="10"
                  fill={u.color}
                  textAnchor="middle"
                  fontWeight="800"
                >
                  ↔{s.offsetMm}
                </text>
              </g>
            );
          })}

          {/* Empty state */}
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
    </div>
  );
}
