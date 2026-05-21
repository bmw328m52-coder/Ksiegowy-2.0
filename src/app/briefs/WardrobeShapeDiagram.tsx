"use client";

import { useEffect, useRef, useState } from "react";

type Shape = "prosta" | "skos_trojkat" | "skos_kolankowy" | "skos_pionowy";

type Dims = {
  shape: Shape;
  widthMm: number;
  heightMm: number;
  kneeWallMm: number;
  ceilingFlatMm: number;
  slopeTopHeightMm: number;
  slopeFloorRunMm: number;
};

const DEFAULTS: Dims = {
  shape: "prosta",
  widthMm: 3000,
  heightMm: 2500,
  kneeWallMm: 800,
  ceilingFlatMm: 1200,
  slopeTopHeightMm: 0,
  slopeFloorRunMm: 0,
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

type Slope = {
  runMm: number;
  riseMm: number;
  lengthMm: number;
  angleDeg: number;
};

function computeSlope(d: Dims): Slope | null {
  if (d.shape === "prosta") return null;
  let run = 0;
  let rise = 0;
  if (d.shape === "skos_trojkat") {
    run = d.widthMm;
    rise = d.heightMm;
  } else if (d.shape === "skos_kolankowy") {
    run = d.widthMm;
    rise = d.heightMm - d.kneeWallMm;
  } else if (d.shape === "skos_pionowy") {
    const topH = d.slopeTopHeightMm > 0 ? d.slopeTopHeightMm : d.heightMm;
    run =
      d.slopeFloorRunMm > 0
        ? d.slopeFloorRunMm
        : Math.max(d.widthMm - d.ceilingFlatMm, 0);
    rise = topH - d.kneeWallMm;
  }
  if (run <= 0 || rise <= 0) return null;
  const length = Math.sqrt(run * run + rise * rise);
  const angleDeg = (Math.atan2(rise, run) * 180) / Math.PI;
  return { runMm: run, riseMm: rise, lengthMm: length, angleDeg };
}

export default function WardrobeShapeDiagram({
  initialShape = "prosta",
}: {
  initialShape?: Shape;
}) {
  const [d, setD] = useState<Dims>({ ...DEFAULTS, shape: initialShape });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const sRaw = radio(form, "room_shape");
      const shape: Shape =
        sRaw === "prosta" ||
        sRaw === "skos_trojkat" ||
        sRaw === "skos_kolankowy" ||
        sRaw === "skos_pionowy"
          ? sRaw
          : initialShape;
      setD({
        shape,
        widthMm: num(form, "width_mm") || DEFAULTS.widthMm,
        heightMm: num(form, "height_mm") || DEFAULTS.heightMm,
        kneeWallMm: num(form, "knee_wall_height_mm") || DEFAULTS.kneeWallMm,
        ceilingFlatMm:
          num(form, "ceiling_flat_mm") || DEFAULTS.ceilingFlatMm,
        slopeTopHeightMm: num(form, "slope_top_height_mm"),
        slopeFloorRunMm: num(form, "slope_floor_run_mm"),
      });
    };
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [initialShape]);

  // SVG geometry
  const VB_W = 360;
  const VB_H = 230;
  const DRAW_X = 40;
  const DRAW_Y = 30;
  const DRAW_W = 280;
  const DRAW_H = 160;
  const FLOOR_Y = DRAW_Y + DRAW_H;

  const scaleW = DRAW_W / Math.max(d.widthMm, 1);
  const scaleH = DRAW_H / Math.max(d.heightMm, 1);
  const scale = Math.min(scaleW, scaleH);
  const wPx = d.widthMm * scale;
  const hPx = d.heightMm * scale;
  const xLeft = DRAW_X;
  const xRight = xLeft + wPx;
  const yTop = FLOOR_Y - hPx;
  const yFloor = FLOOR_Y;
  const yKnee = FLOOR_Y - d.kneeWallMm * scale;

  // For pentagon
  const ceilingFlatPx = d.ceilingFlatMm * scale;
  const slopeTopH = d.slopeTopHeightMm > 0 ? d.slopeTopHeightMm : d.heightMm;
  const ySlopeTop = FLOOR_Y - slopeTopH * scale;
  const slopeRun =
    d.slopeFloorRunMm > 0
      ? d.slopeFloorRunMm
      : Math.max(d.widthMm - d.ceilingFlatMm, 0);
  const xSlopeStart = xRight - slopeRun * scale;

  // Polygon points
  let points = "";
  if (d.shape === "prosta") {
    points = `${xLeft},${yTop} ${xRight},${yTop} ${xRight},${yFloor} ${xLeft},${yFloor}`;
  } else if (d.shape === "skos_trojkat") {
    points = `${xLeft},${yTop} ${xRight},${yFloor} ${xLeft},${yFloor}`;
  } else if (d.shape === "skos_kolankowy") {
    points = `${xLeft},${yTop} ${xRight},${yKnee} ${xRight},${yFloor} ${xLeft},${yFloor}`;
  } else if (d.shape === "skos_pionowy") {
    points = `${xLeft},${yTop} ${xSlopeStart},${ySlopeTop} ${xRight},${yKnee} ${xRight},${yFloor} ${xLeft},${yFloor}`;
  }

  const slope = computeSlope(d);

  // Slope line endpoints for label
  let slopeMidX = 0;
  let slopeMidY = 0;
  let slopeAngleVisual = 0;
  if (d.shape === "skos_trojkat") {
    slopeMidX = (xLeft + xRight) / 2;
    slopeMidY = (yTop + yFloor) / 2;
    slopeAngleVisual =
      (Math.atan2(yFloor - yTop, xRight - xLeft) * 180) / Math.PI;
  } else if (d.shape === "skos_kolankowy") {
    slopeMidX = (xLeft + xRight) / 2;
    slopeMidY = (yTop + yKnee) / 2;
    slopeAngleVisual =
      (Math.atan2(yKnee - yTop, xRight - xLeft) * 180) / Math.PI;
  } else if (d.shape === "skos_pionowy") {
    slopeMidX = (xSlopeStart + xRight) / 2;
    slopeMidY = (ySlopeTop + yKnee) / 2;
    slopeAngleVisual =
      (Math.atan2(yKnee - ySlopeTop, xRight - xSlopeStart) * 180) / Math.PI;
  }

  return (
    <div ref={ref} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-800">
          Przekrój pomieszczenia
        </p>
        <p className="text-[11px] text-zinc-500">widok z boku</p>
      </div>

      <div className="rounded-lg bg-white border border-zinc-200 p-2">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full block"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Floor line extended */}
          <line
            x1={xLeft - 10}
            y1={yFloor}
            x2={xRight + 10}
            y2={yFloor}
            stroke="#282624"
            strokeWidth="1.2"
          />

          {/* Room shape */}
          <polygon
            points={points}
            fill="#fafaf9"
            stroke="#282624"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Vertical dim line — height H */}
          <line
            x1={xLeft - 14}
            y1={yTop}
            x2={xLeft - 14}
            y2={yFloor}
            stroke="#71717a"
            strokeWidth="0.6"
          />
          <line
            x1={xLeft - 17}
            y1={yTop}
            x2={xLeft - 11}
            y2={yTop}
            stroke="#71717a"
            strokeWidth="0.6"
          />
          <line
            x1={xLeft - 17}
            y1={yFloor}
            x2={xLeft - 11}
            y2={yFloor}
            stroke="#71717a"
            strokeWidth="0.6"
          />
          <text
            x={xLeft - 20}
            y={(yTop + yFloor) / 2 + 3}
            fontSize="10"
            fill="#282624"
            textAnchor="end"
            fontWeight="700"
          >
            H={d.heightMm}
          </text>

          {/* Horizontal dim line — width */}
          <line
            x1={xLeft}
            y1={yFloor + 14}
            x2={xRight}
            y2={yFloor + 14}
            stroke="#71717a"
            strokeWidth="0.6"
          />
          <line
            x1={xLeft}
            y1={yFloor + 11}
            x2={xLeft}
            y2={yFloor + 17}
            stroke="#71717a"
            strokeWidth="0.6"
          />
          <line
            x1={xRight}
            y1={yFloor + 11}
            x2={xRight}
            y2={yFloor + 17}
            stroke="#71717a"
            strokeWidth="0.6"
          />
          <text
            x={(xLeft + xRight) / 2}
            y={yFloor + 26}
            fontSize="10"
            fill="#282624"
            textAnchor="middle"
            fontWeight="700"
          >
            szer. {d.widthMm}
          </text>

          {/* Knee wall height label */}
          {(d.shape === "skos_kolankowy" || d.shape === "skos_pionowy") && (
            <>
              <line
                x1={xRight + 14}
                y1={yKnee}
                x2={xRight + 14}
                y2={yFloor}
                stroke="#71717a"
                strokeWidth="0.6"
              />
              <line
                x1={xRight + 11}
                y1={yKnee}
                x2={xRight + 17}
                y2={yKnee}
                stroke="#71717a"
                strokeWidth="0.6"
              />
              <line
                x1={xRight + 11}
                y1={yFloor}
                x2={xRight + 17}
                y2={yFloor}
                stroke="#71717a"
                strokeWidth="0.6"
              />
              <text
                x={xRight + 20}
                y={(yKnee + yFloor) / 2 + 3}
                fontSize="9"
                fill="#52525b"
                fontWeight="700"
              >
                {d.kneeWallMm}
              </text>
            </>
          )}

          {/* Flat ceiling label for pentagon */}
          {d.shape === "skos_pionowy" && ceilingFlatPx > 10 && (
            <>
              <line
                x1={xLeft}
                y1={yTop - 8}
                x2={xLeft + ceilingFlatPx}
                y2={yTop - 8}
                stroke="#71717a"
                strokeWidth="0.6"
              />
              <line
                x1={xLeft}
                y1={yTop - 11}
                x2={xLeft}
                y2={yTop - 5}
                stroke="#71717a"
                strokeWidth="0.6"
              />
              <line
                x1={xLeft + ceilingFlatPx}
                y1={yTop - 11}
                x2={xLeft + ceilingFlatPx}
                y2={yTop - 5}
                stroke="#71717a"
                strokeWidth="0.6"
              />
              <text
                x={xLeft + ceilingFlatPx / 2}
                y={yTop - 12}
                fontSize="9"
                fill="#52525b"
                textAnchor="middle"
                fontWeight="700"
              >
                sufit {d.ceilingFlatMm}
              </text>
            </>
          )}

          {/* Slope length + angle label on slope */}
          {slope && (
            <g
              transform={`translate(${slopeMidX} ${slopeMidY}) rotate(${slopeAngleVisual})`}
            >
              <rect
                x={-38}
                y={-9}
                width={76}
                height={14}
                rx={3}
                fill="#fef3c7"
                stroke="#d97706"
                strokeWidth="0.6"
              />
              <text
                x={0}
                y={1.5}
                fontSize="9"
                fill="#92400e"
                textAnchor="middle"
                fontWeight="800"
              >
                L={Math.round(slope.lengthMm)} · {slope.angleDeg.toFixed(1)}°
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Stats / description panel */}
      {slope ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-zinc-200 bg-white p-2">
            <p className="text-zinc-500 text-[10px] uppercase tracking-wide">
              Długość skosu
            </p>
            <p className="text-lg font-bold text-zinc-900 tabular-nums">
              {Math.round(slope.lengthMm)} mm
            </p>
            <p className="text-[10px] text-zinc-500 tabular-nums">
              rzut {Math.round(slope.runMm)} · różnica wys.{" "}
              {Math.round(slope.riseMm)}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-2">
            <p className="text-zinc-500 text-[10px] uppercase tracking-wide">
              Kąt nachylenia
            </p>
            <p className="text-lg font-bold text-zinc-900 tabular-nums">
              {slope.angleDeg.toFixed(1)}°
            </p>
            <p className="text-[10px] text-zinc-500">od poziomu</p>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-center text-zinc-600 mt-2">
        {d.shape === "prosta" && "Prostokątne pomieszczenie"}
        {d.shape === "skos_trojkat" &&
          "Trójkątna wnęka — skos od podłogi do pełnej wysokości"}
        {d.shape === "skos_kolankowy" &&
          "Skos z kolankiem — prawa ścianka + skos do góry"}
        {d.shape === "skos_pionowy" &&
          "Skos + prosty fragment sufitu (np. poddasze)"}
      </p>
    </div>
  );
}
