"use client";

import { useState } from "react";

type Entry = { label: string; color: string; edgeColor: string };

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent";

const SLOTS: { label: string; hint: string }[] = [
  { label: "Baza kuchni", hint: "Główny kolor korpusów (np. K001 Biały)" },
  { label: "Dodatkowy kolor", hint: "Opcjonalny — zostaw puste, jeśli nieużywany" },
];

function emptyEntries(): Entry[] {
  return SLOTS.map((s) => ({ label: s.label, color: "", edgeColor: "" }));
}

function parseInitial(json?: string, fallbackColor?: string): Entry[] {
  const base = emptyEntries();
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        parsed.forEach((e, idx) => {
          if (idx >= SLOTS.length) return;
          base[idx] = {
            label: SLOTS[idx].label,
            color: typeof e?.color === "string" ? e.color : "",
            edgeColor: typeof e?.edgeColor === "string" ? e.edgeColor : "",
          };
        });
        return base;
      }
    } catch {
      // ignore parse errors, fall through
    }
  }
  if (fallbackColor) base[0].color = fallbackColor;
  return base;
}

export default function CorpusListInput({
  initialJson,
  fallbackColor,
}: {
  initialJson?: string;
  fallbackColor?: string;
}) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    parseInitial(initialJson, fallbackColor)
  );

  const trimmed = entries
    .map((e) => ({
      label: e.label,
      color: (e.color ?? "").trim(),
      edgeColor: (e.edgeColor ?? "").trim(),
    }))
    .filter((e) => e.color !== "" || e.edgeColor !== "");
  const json = trimmed.length > 0 ? JSON.stringify(trimmed) : "";

  function updateAt(i: number, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-medium text-zinc-700">Korpusy</span>
      <input type="hidden" name="data.corpus_list" value={json} />

      {entries.map((e, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-md border border-zinc-200 p-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-semibold text-zinc-800">{SLOTS[i].label}</span>
            <span className="text-[11px] text-zinc-500">{SLOTS[i].hint}</span>
          </div>
          <input
            type="text"
            placeholder="Kolor płyty / dekor"
            value={e.color}
            onChange={(ev) => updateAt(i, { color: ev.target.value })}
            className={`${inputCls} w-full`}
          />
          <input
            type="text"
            placeholder="Okleina krawędzi (np. ABS 2 mm w kolorze płyty)"
            value={e.edgeColor}
            onChange={(ev) => updateAt(i, { edgeColor: ev.target.value })}
            className={`${inputCls} w-full`}
          />
        </div>
      ))}

      <span className="text-[11px] text-zinc-500">
        Okleinę zostaw pustą, jeśli ma być w kolorze płyty. Dodatkowy kolor możesz pominąć.
      </span>
    </div>
  );
}
