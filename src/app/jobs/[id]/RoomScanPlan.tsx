import type { ScanData } from "@/lib/dao/room_scans.types";
import { SCAN_OBJECT_LABELS } from "@/lib/dao/room_scans.types";

const WALL = "#1f1d1b";
const DOOR = "#a06f3f";
const WINDOW = "#3b82f6";
const OBJECT_FILL = "#f4ece2";
const OBJECT_STROKE = "#c9a37a";
const DIM = "#71717a";

/** Litery ścian: A, B, C… — te same co w tabeli pod rzutem. */
export function wallLetter(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : `W${i + 1}`;
}

/** Rzut z góry w mm (viewBox w mm, skaluje się do szerokości kontenera). */
export default function RoomScanPlan({ data }: { data: ScanData }) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const w of data.walls) xs.push(w.x1, w.x2), ys.push(w.y1, w.y2);
  for (const o of data.objects) {
    const r = Math.max(o.width_mm, o.depth_mm) / 2;
    xs.push(o.cx - r, o.cx + r), ys.push(o.cy - r, o.cy + r);
  }
  if (xs.length === 0) {
    return <p className="text-xs text-zinc-500">Skan nie zawiera ścian.</p>;
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const size = Math.max(maxX - minX, maxY - minY, 1000);
  const pad = size * 0.14;
  const font = size / 32;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`}
      className="w-full h-auto max-h-[420px] bg-[#fafaf9] rounded-lg"
      role="img"
      aria-label="Rzut pomieszczenia ze skanu"
    >
      {data.objects.map((o) => (
        <g key={o.id} transform={`translate(${o.cx} ${o.cy}) rotate(${o.rotation_deg})`}>
          <rect
            x={-o.width_mm / 2}
            y={-o.depth_mm / 2}
            width={o.width_mm}
            height={o.depth_mm}
            fill={OBJECT_FILL}
            stroke={OBJECT_STROKE}
            strokeWidth={size / 400}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={font * 0.8}
            fill="#6b4a2a"
            transform={`rotate(${-o.rotation_deg})`}
          >
            {SCAN_OBJECT_LABELS[o.category] ?? o.category}
          </text>
        </g>
      ))}

      {data.walls.map((w) => (
        <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke={WALL} strokeWidth={size / 70} strokeLinecap="square" />
      ))}

      {data.openings.map((o) => (
        <line
          key={o.id}
          x1={o.x1}
          y1={o.y1}
          x2={o.x2}
          y2={o.y2}
          stroke={o.kind === "window" ? WINDOW : o.kind === "door" ? DOOR : "#fafaf9"}
          strokeWidth={size / 50}
        />
      ))}

      {data.walls.map((w, i) => {
        // Etykieta odsunięta od środka ściany na zewnątrz pomieszczenia.
        const mx = (w.x1 + w.x2) / 2;
        const my = (w.y1 + w.y2) / 2;
        const dx = w.x2 - w.x1;
        const dy = w.y2 - w.y1;
        const len = Math.hypot(dx, dy) || 1;
        let nx = -dy / len;
        let ny = dx / len;
        if ((mx - cx) * nx + (my - cy) * ny < 0) (nx = -nx), (ny = -ny);
        const off = font * 1.6;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        return (
          <text
            key={w.id}
            x={mx + nx * off}
            y={my + ny * off}
            fontSize={font}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={DIM}
            transform={`rotate(${angle} ${mx + nx * off} ${my + ny * off})`}
          >
            <tspan fontWeight={700} fill={WALL}>{wallLetter(i)}</tspan> {Math.round(w.length_mm)}
          </text>
        );
      })}
    </svg>
  );
}
