"use client";

import { useState } from "react";
import { fmtPLN } from "@/lib/format";
import type { MonthlyPoint } from "@/lib/dao/dashboard";

const MONTH_ABBR = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const MONTH_FULL = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

/** Ładna górna granica skali (1, 2, 2.5, 5 × 10^n), żeby linie siatki wypadały na okrągłych kwotach. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

function axisLabel(v: number): string {
  if (v === 0) return "0";
  if (v >= 1000) return `${String(Math.round((v / 1000) * 10) / 10).replace(".", ",")} tys.`;
  return String(v);
}

/** Słupek zaokrąglony tylko u góry (4 px), oparty płasko o linię bazową. */
function barPath(x: number, baseY: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${baseY} V${baseY - h + r} Q${x},${baseY - h} ${x + r},${baseY - h} H${x + w - r} Q${x + w},${baseY - h} ${x + w},${baseY - h + r} V${baseY} Z`;
}

/**
 * Przychód i koszty netto w skali roku.
 * Kolory z tokenów --chart-1 / --chart-2 (zwalidowane pod kątem daltonizmu i kontrastu).
 * Odczyt wybranego miesiąca pod wykresem: dotyk, najechanie i klawiatura działają tak samo.
 */
export default function MonthlyBars({
  data,
  highlightMonth,
}: {
  data: MonthlyPoint[];
  highlightMonth?: number;
}) {
  const initial = highlightMonth !== undefined && data[highlightMonth] ? highlightMonth : data.length - 1;
  const [sel, setSel] = useState(initial);

  const W = 360;
  const H = 200;
  const padTop = 10;
  const padBottom = 24;
  const padLeft = 48;
  const padRight = 6;
  const chartH = H - padTop - padBottom;
  const chartW = W - padLeft - padRight;
  const baseY = padTop + chartH;

  const top = niceMax(Math.max(1, ...data.map((p) => Math.max(p.revenueNet, p.costsNet))));
  const ticks = [0, top / 2, top];
  const slotW = chartW / data.length;
  const barW = Math.max(3, slotW * 0.34);
  const gap = 2;

  const cur = data[sel];
  const result = cur ? cur.revenueNet - cur.costsNet : 0;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="group"
        aria-label="Przychód i koszty netto w poszczególnych miesiącach"
      >
        {ticks.map((t) => {
          const y = baseY - (t / top) * chartH;
          return (
            <g key={t}>
              <line
                x1={padLeft}
                x2={W - padRight}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth={t === 0 ? 1.5 : 1}
                strokeDasharray={t === 0 ? undefined : "2 3"}
              />
              <text
                className="money"
                x={padLeft - 6}
                y={y + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="var(--muted)"
              >
                {axisLabel(t)}
              </text>
            </g>
          );
        })}

        {data.map((p, i) => {
          const center = padLeft + i * slotW + slotW / 2;
          const revH = (p.revenueNet / top) * chartH;
          const costH = (p.costsNet / top) * chartH;
          const active = i === sel;
          const op = active ? 1 : 0.78;
          return (
            <g
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`${MONTH_FULL[i]}: przychód ${fmtPLN(p.revenueNet)}, koszty ${fmtPLN(p.costsNet)}`}
              aria-pressed={active}
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
              onClick={() => setSel(i)}
              className="cursor-pointer outline-none focus-visible:[&>rect:first-child]:stroke-[var(--accent)]"
            >
              <rect
                x={padLeft + i * slotW}
                y={0}
                width={slotW}
                height={H}
                fill={active ? "var(--surface-2)" : "transparent"}
                stroke="transparent"
                strokeWidth={1.5}
                rx={6}
              />
              <path d={barPath(center - barW - gap / 2, baseY, barW, revH)} fill="var(--chart-1)" opacity={op} />
              <path d={barPath(center + gap / 2, baseY, barW, costH)} fill="var(--chart-2)" opacity={op} />
              <text
                x={center}
                y={H - 7}
                textAnchor="middle"
                fontSize={10}
                fill={active ? "var(--foreground)" : "var(--muted)"}
                fontWeight={active ? 700 : 500}
              >
                {MONTH_ABBR[i]}
              </text>
            </g>
          );
        })}
      </svg>

      {cur && (
        <dl
          className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-xl bg-[var(--surface-2)] px-3.5 py-3 text-[13px]"
          aria-live="polite"
        >
          <dt className="col-span-2 text-[13px] font-semibold text-[var(--foreground)]">
            {MONTH_FULL[sel]}
          </dt>
          <dd className="contents">
            <span className="inline-flex items-center gap-2 text-[var(--ink-2)]">
              <span aria-hidden className="inline-block w-3 h-3 rounded-[3px]" style={{ background: "var(--chart-1)" }} />
              Przychód netto
            </span>
            <span className="money text-right font-semibold tabular-nums">{fmtPLN(cur.revenueNet)}</span>
            <span className="inline-flex items-center gap-2 text-[var(--ink-2)]">
              <span aria-hidden className="inline-block w-3 h-3 rounded-[3px]" style={{ background: "var(--chart-2)" }} />
              Koszty netto
            </span>
            <span className="money text-right font-semibold tabular-nums">{fmtPLN(cur.costsNet)}</span>
            <span className="text-[var(--ink-2)] border-t border-[var(--border)] pt-1.5">Wynik</span>
            <span
              className={`money text-right font-semibold tabular-nums border-t border-[var(--border)] pt-1.5 ${
                result < 0 ? "text-[var(--warn)]" : "text-[var(--foreground)]"
              }`}
            >
              {result > 0 ? "+" : ""}
              {fmtPLN(result)}
            </span>
          </dd>
        </dl>
      )}
    </div>
  );
}
