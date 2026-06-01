"use client";

import { useState, useTransition } from "react";
import { setItemQtyAction } from "./actions";

export default function QtyCalculator({
  briefId,
  jobId,
  fieldKey,
  label,
  unit,
  initial,
}: {
  briefId: string;
  jobId: string;
  fieldKey: string;
  label: string;
  unit: string;
  initial: number[];
}) {
  // Stara wersja zapisywała partie jako tablicę (np. [4,3,2]); nowy pojedynczy
  // input pokazuje i zapisuje ich sumę, żeby nie zgubić istniejących pomiarów.
  const initialFirst =
    initial.length > 0 ? formatNum(initial.reduce((a, b) => a + b, 0)) : "";
  const [value, setValue] = useState<string>(initialFirst);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (raw: string) => {
    const normalized = raw.trim();
    if (normalized === initialFirst) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("qty[0]", normalized);
        await setItemQtyAction(briefId, jobId, fieldKey, fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd zapisu.");
      }
    });
  };

  return (
    <div className="mt-2 rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 flex items-center justify-between gap-2">
      <span className="text-xs text-zinc-700">{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          inputMode="decimal"
          placeholder="—"
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => save(e.target.value)}
          className={`w-20 rounded-md border px-2 py-1 text-right text-sm tabular-nums focus:outline-none ${
            error
              ? "border-red-300 bg-red-50"
              : "border-zinc-300 bg-white focus:border-accent"
          } disabled:opacity-60`}
        />
        <span className="text-xs text-zinc-500 shrink-0">{unit}</span>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}
