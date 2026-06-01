import type { BriefData } from "@/lib/dao/quote_briefs.types";
import { ROOM_LAYOUT_LABELS, parseRoomLayout, wallVisibility } from "@/app/briefs/roomLayout";

const WALL = "#282624";
const WINDOW = "#3b82f6";
const ROOM_FILL = "#fafaf9";
const ROOM_OUTLINE = "#e4e4e7";
const WALL_THICKNESS = 4;
const FALLBACK_MM = 3000;
const MAX_W = 130;
const MAX_H = 100;

function toNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const s = v.trim().replace(/\s+/g, "");
    const range = s.match(/^(\d+(?:[.,]\d+)?)[-–—](\d+(?:[.,]\d+)?)$/);
    if (range) {
      const a = Number(range[1].replace(",", "."));
      const b = Number(range[2].replace(",", "."));
      if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
    }
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function fmt(v: number | string): string {
  return `${v} mm`;
}

function rawDim(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return undefined;
}

export default function RoomMiniDiagram({ data }: { data: BriefData }) {
  const layout = parseRoomLayout(data.room_layout);
  if (!layout) return null;

  const wA = toNum(data.wall_a_mm);
  const wB = toNum(data.wall_b_mm);
  const wC = toNum(data.wall_c_mm);
  const wD = toNum(data.wall_d_mm);
  const wAraw = rawDim(data.wall_a_mm);
  const wBraw = rawDim(data.wall_b_mm);
  const wCraw = rawDim(data.wall_c_mm);
  const wDraw = rawDim(data.wall_d_mm);

  const windowWall = typeof data.window_wall === "string" ? data.window_wall : "";

  const { showB, showC, showD, halfD } = wallVisibility(layout);

  const aMm = wA ?? FALLBACK_MM;
  const bMm = showB ? (wB ?? FALLBACK_MM) : 0;
  const cMm = showC ? (wC ?? FALLBACK_MM) : 0;
  const dMm = showD ? (wD ?? FALLBACK_MM) : 0;

  const wRefMm = Math.max(bMm, dMm, 1);
  const hRefMm = Math.max(aMm, cMm, 1);

  const scale = layout === "lin"
    ? MAX_H / Math.max(aMm, 1)
    : Math.min(MAX_W / wRefMm, MAX_H / hRefMm);

  const aPx = aMm * scale;
  const bPx = bMm * scale;
  const cPx = cMm * scale;
  const dPx = dMm * scale;

  const roomW = layout === "lin" ? WALL_THICKNESS : Math.max(bPx, dPx);
  const roomH = Math.max(aPx, cPx);

  const cx = 100;
  const cy = 80;
  const x0 = cx - roomW / 2;
  const y0 = cy - roomH / 2;

  const cX = showD ? x0 + Math.max(bPx, dPx) : x0 + bPx;
  const dY = y0 + Math.max(aPx, cPx);
  const dX1 = halfD ? cX - dPx : x0;
  const dX2 = halfD ? cX : x0 + dPx;

  const aMidY = y0 + aPx / 2;
  const bMidX = x0 + bPx / 2;
  const cMidY = y0 + cPx / 2;
  const dMidX = (dX1 + dX2) / 2;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <svg viewBox="0 0 200 160" className="w-full max-w-[300px] mx-auto block">
        {layout !== "lin" && roomW > 0 && roomH > 0 && (
          <rect x={x0} y={y0} width={roomW} height={roomH} fill={ROOM_FILL} stroke={ROOM_OUTLINE} strokeDasharray="2 2" />
        )}

        {/* Wall A — left vertical */}
        <line x1={x0} y1={y0} x2={x0} y2={y0 + aPx}
          stroke={windowWall === "a" ? WINDOW : WALL} strokeWidth={WALL_THICKNESS} strokeLinecap="square" />
        <text x={x0 - 5} y={aMidY} textAnchor="end" dominantBaseline="middle"
          fill={wAraw ? "#3f3f46" : "#a1a1aa"} fontSize="9" fontWeight="600">
          {wAraw ? fmt(wAraw) : "A —"}
        </text>

        {/* Wall B — top */}
        {showB && (
          <>
            <line x1={x0} y1={y0} x2={x0 + bPx} y2={y0}
              stroke={windowWall === "b" ? WINDOW : WALL} strokeWidth={WALL_THICKNESS} strokeLinecap="square" />
            <text x={bMidX} y={y0 - 6} textAnchor="middle"
              fill={wBraw ? "#3f3f46" : "#a1a1aa"} fontSize="9" fontWeight="600">
              {wBraw ? fmt(wBraw) : "B —"}
            </text>
          </>
        )}

        {/* Wall C — right */}
        {showC && (
          <>
            <line x1={cX} y1={y0} x2={cX} y2={y0 + cPx}
              stroke={windowWall === "c" ? WINDOW : WALL} strokeWidth={WALL_THICKNESS} strokeLinecap="square" />
            <text x={cX + 5} y={cMidY} textAnchor="start" dominantBaseline="middle"
              fill={wCraw ? "#3f3f46" : "#a1a1aa"} fontSize="9" fontWeight="600">
              {wCraw ? fmt(wCraw) : "C —"}
            </text>
          </>
        )}

        {/* Wall D — bottom (full or half from right toward C) */}
        {showD && (
          <>
            <line x1={dX1} y1={dY} x2={dX2} y2={dY}
              stroke={windowWall === "d" ? WINDOW : WALL} strokeWidth={WALL_THICKNESS} strokeLinecap="square" />
            <text x={dMidX} y={dY + 12} textAnchor="middle"
              fill={wDraw ? "#3f3f46" : "#a1a1aa"} fontSize="9" fontWeight="600">
              {wDraw ? fmt(wDraw) : "D —"}
            </text>
          </>
        )}
      </svg>
      <p className="text-[11px] text-center text-zinc-500 mt-1">
        {ROOM_LAYOUT_LABELS[layout]}
        {windowWall && ` • okno: ${windowWall.toUpperCase()}`}
      </p>
    </div>
  );
}
