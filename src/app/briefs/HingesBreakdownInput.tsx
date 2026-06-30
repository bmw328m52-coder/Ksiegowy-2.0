"use client";

import { useState } from "react";
import { coerceCount, serializeBreakdown, type BreakdownEntry as Entry } from "./breakdownEntries";

const TYPES: { value: string; label: string }[] = [
  { value: "110_z", label: "110° z hamulcem" },
  { value: "110_bez", label: "110° bez hamulca" },
  { value: "155_z", label: "155° z hamulcem" },
  { value: "155_bez", label: "155° bez hamulca" },
  { value: "rownolegle_z", label: "Równoległe z hamulcem" },
  { value: "rownolegle_bez", label: "Równoległe bez hamulca" },
];

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent";

function emptyEntries(): Entry[] {
  return TYPES.map((t) => ({ type: t.value, count: "" }));
}

function parseInitial(json?: string): Entry[] {
  const base = emptyEntries();
  if (!json) return base;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      parsed.forEach((e) => {
        const type = typeof e?.type === "string" ? e.type : "";
        const idx = TYPES.findIndex((t) => t.value === type);
        if (idx === -1) return;
        base[idx] = { type, count: coerceCount(e?.count) };
      });
    }
  } catch {
    // ignore
  }
  return base;
}

export default function HingesBreakdownInput({
  initialJson,
}: {
  initialJson?: string;
}) {
  const [entries, setEntries] = useState<Entry[]>(() => parseInitial(initialJson));

  const { json, total } = serializeBreakdown(entries);

  function updateAt(i: number, count: string) {
    setEntries((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, count } : e))
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-medium text-zinc-700">Zawiasy — rozbicie po typie</span>
      <input type="hidden" name="data.hinges_breakdown" value={json} />

      <div className="flex flex-col gap-1.5 rounded-md border border-zinc-200 p-2">
        {entries.map((e, i) => (
          <div key={e.type} className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-zinc-800 flex-1 min-w-0">
              {TYPES[i].label}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="0"
              value={e.count}
              onChange={(ev) => updateAt(i, ev.target.value)}
              className={`${inputCls} w-24`}
            />
            <span className="text-[11px] text-zinc-500">szt</span>
          </div>
        ))}
      </div>

      <span className="text-[11px] text-zinc-500">
        Wpisz ilość przy każdym typie. Producent zawiasów dotyczy wszystkich.
        {total > 0 && <> Łącznie: <span className="font-medium text-zinc-700">{total} szt</span>.</>}
      </span>
    </div>
  );
}
