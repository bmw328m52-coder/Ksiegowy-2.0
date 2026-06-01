"use client";

import { useState } from "react";
import { coerceCount, serializeBreakdown, type BreakdownEntry as Entry } from "./breakdownEntries";

const SLOT_COUNT = 2;

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent";

function emptyEntries(): Entry[] {
  return Array.from({ length: SLOT_COUNT }, () => ({ type: "", count: "" }));
}

function parseInitial(json?: string): Entry[] {
  const base = emptyEntries();
  if (!json) return base;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      parsed.slice(0, SLOT_COUNT).forEach((e, i) => {
        const type = typeof e?.type === "string" ? e.type : "";
        base[i] = { type, count: coerceCount(e?.count) };
      });
    }
  } catch {
    // ignore
  }
  return base;
}

export default function LiftBreakdownInput({
  initialJson,
}: {
  initialJson?: string;
}) {
  const [entries, setEntries] = useState<Entry[]>(() => parseInitial(initialJson));

  const { json, total } = serializeBreakdown(entries, { requireType: true });

  function updateAt(i: number, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-medium text-zinc-700">Siłowniki — typy i ilości</span>
      <input type="hidden" name="data.lift_breakdown" value={json} />

      <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-2">
        {entries.map((e, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-zinc-600">
              Typ {i + 1}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="np. Aventos HF / HK / HL / HS"
                value={e.type}
                onChange={(ev) => updateAt(i, { type: ev.target.value })}
                className={`${inputCls} flex-1`}
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="0"
                value={e.count}
                onChange={(ev) => updateAt(i, { count: ev.target.value })}
                className={`${inputCls} w-20`}
              />
              <span className="text-[11px] text-zinc-500">szt</span>
            </div>
          </div>
        ))}
      </div>

      <span className="text-[11px] text-zinc-500">
        Producent siłowników dotyczy obu typów. Drugi typ zostaw pusty, jeśli niepotrzebny.
        {total > 0 && <> Łącznie: <span className="font-medium text-zinc-700">{total} szt</span>.</>}
      </span>
    </div>
  );
}
