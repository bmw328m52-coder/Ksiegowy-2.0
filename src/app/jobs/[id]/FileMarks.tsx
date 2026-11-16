import type { FileMark, TextMark } from "@/lib/dao/job_files.types";

// Ten sam krój w SVG i przy mierzeniu szerokości — inaczej białe tło nie pasuje do napisu.
const FONT = "Arial, Helvetica, sans-serif";
const LINE_HEIGHT = 1.2;

let measureCtx: CanvasRenderingContext2D | null = null;
function lineWidth(text: string, s: number): number {
  if (typeof document === "undefined") return text.length * s * 0.58;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * s * 0.58;
  measureCtx.font = `700 ${s}px ${FONT}`;
  return measureCtx.measureText(text).width;
}

/** Rozmiar tekstu przed obrotem. */
function flatSize(m: Pick<TextMark, "text" | "s">): { w: number; h: number } {
  const lines = m.text.split("\n");
  return {
    w: Math.max(...lines.map((l) => lineWidth(l, m.s)), m.s * 0.5),
    h: lines.length * m.s * LINE_HEIGHT,
  };
}

/** Widoczny prostokąt tekstu (bez marginesu tła), w pikselach obrazu; dla pionowego — po obrocie. */
export function textBox(m: Pick<TextMark, "text" | "s" | "x" | "y" | "v">): { x: number; y: number; w: number; h: number } {
  const f = flatSize(m);
  return m.v ? { x: m.x, y: m.y, w: f.h, h: f.w } : { x: m.x, y: m.y, ...f };
}

function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Czy punkt (piksele obrazu) trafia w poprawkę, z tolerancją `tol`. */
export function markHit(m: FileMark, px: number, py: number, tol: number): boolean {
  if (m.t === "text") {
    const b = textBox(m);
    return px >= b.x - tol && px <= b.x + b.w + tol && py >= b.y - tol && py <= b.y + b.h + tol;
  }
  if (m.t === "line") return segDist(px, py, m.x1, m.y1, m.x2, m.y2) <= tol + m.w / 2;
  for (let i = 0; i + 3 < m.pts.length; i += 2) {
    if (segDist(px, py, m.pts[i], m.pts[i + 1], m.pts[i + 2], m.pts[i + 3]) <= tol + m.w / 2) return true;
  }
  return false;
}

function Mark({ m }: { m: FileMark }) {
  if (m.t === "pen") {
    let d = `M${m.pts[0]} ${m.pts[1]}`;
    for (let i = 2; i + 1 < m.pts.length; i += 2) d += `L${m.pts[i]} ${m.pts[i + 1]}`;
    return <path d={d} fill="none" stroke={m.c} strokeWidth={m.w} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (m.t === "line") {
    return <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={m.c} strokeWidth={m.w} strokeLinecap="round" />;
  }
  const b = textBox(m);
  const f = flatSize(m);
  const pad = m.s * 0.22;
  // Rysujemy w układzie nieobróconym; pionowy tekst obracamy o -90° wokół środka prostokąta.
  const transform = m.v ? `translate(${b.x + b.w / 2} ${b.y + b.h / 2}) rotate(-90) translate(${-f.w / 2} ${-f.h / 2})` : `translate(${b.x} ${b.y})`;
  return (
    <g transform={transform}>
      {m.bg && (
        <rect
          x={-pad}
          y={-pad}
          width={f.w + 2 * pad}
          height={f.h + 2 * pad}
          rx={pad}
          fill="#ffffff"
          fillOpacity={0.97}
          stroke={m.c}
          strokeWidth={m.s * 0.05}
        />
      )}
      {m.text.split("\n").map((line, i) => (
        <text
          key={i}
          x={0}
          y={i * m.s * LINE_HEIGHT + m.s * 0.92}
          fontSize={m.s}
          fontWeight={700}
          fontFamily={FONT}
          fill={m.c}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/** Warstwa poprawek nad obrazem; viewBox = rozmiar obrazu, więc skaluje się razem z nim. */
export function MarksLayer({
  marks,
  width,
  height,
  className,
}: {
  marks: FileMark[];
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      {marks.map((m) => (
        <Mark key={m.id} m={m} />
      ))}
    </svg>
  );
}
