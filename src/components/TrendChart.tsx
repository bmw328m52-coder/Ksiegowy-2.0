import type { MonthlyPoint } from "@/lib/dao/dashboard";

const MONTH_ABBR = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

export default function TrendChart({
  data,
  highlightMonth,
}: {
  data: MonthlyPoint[];
  highlightMonth?: number;
}) {
  const W = 360;
  const H = 180;
  const padTop = 8;
  const padBottom = 22;
  const padLeft = 8;
  const padRight = 8;
  const chartH = H - padTop - padBottom;
  const chartW = W - padLeft - padRight;

  const max = Math.max(
    1,
    ...data.map((p) => Math.max(p.revenueNet, p.costsNet))
  );
  const slotW = chartW / data.length;
  const barW = Math.max(2, slotW * 0.35);
  const gap = slotW * 0.1;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Trend miesięczny">
        <line
          x1={padLeft}
          x2={W - padRight}
          y1={padTop + chartH}
          y2={padTop + chartH}
          stroke="#e4e4e7"
          strokeWidth={1}
        />

        {data.map((p, i) => {
          const slotX = padLeft + i * slotW;
          const center = slotX + slotW / 2;
          const revH = (p.revenueNet / max) * chartH;
          const costH = (p.costsNet / max) * chartH;
          const baseY = padTop + chartH;
          const isHL = i === highlightMonth;
          const revFill = isHL ? "#282624" : "#3f3d3a";
          const costFill = isHL ? "#d97706" : "#f59e0b";
          return (
            <g key={i}>
              <rect
                x={center - barW - gap / 2}
                y={baseY - revH}
                width={barW}
                height={revH}
                fill={revFill}
                rx={1}
              />
              <rect
                x={center + gap / 2}
                y={baseY - costH}
                width={barW}
                height={costH}
                fill={costFill}
                rx={1}
              />
              <text
                x={center}
                y={H - 6}
                textAnchor="middle"
                fontSize={9}
                fill={isHL ? "#282624" : "#71717a"}
                fontWeight={isHL ? 600 : 400}
              >
                {MONTH_ABBR[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 text-[11px] text-zinc-600 mt-2 px-2">
        <Legend color="#3f3d3a" label="Przychód" />
        <Legend color="#f59e0b" label="Koszty" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
