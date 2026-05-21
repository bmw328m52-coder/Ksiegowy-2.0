"use client";

import { useState, useTransition } from "react";
import { setItemQtyAction } from "./actions";

const COUNT = 5;

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
  const padded: (number | null)[] = [
    ...initial,
    ...Array<number | null>(COUNT).fill(null),
  ].slice(0, COUNT);
  const [values, setValues] = useState<string[]>(
    padded.map((v) => (v === null || v === undefined ? "" : formatNum(v)))
  );
  const [open, setOpen] = useState(initial.length > 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sum = values.reduce((acc, v) => acc + parseNum(v), 0);

  const save = (next: string[]) => {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        next.forEach((v, i) => fd.set(`qty[${i}]`, v));
        await setItemQtyAction(briefId, jobId, fieldKey, fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd zapisu.");
      }
    });
  };

  const updateAt = (i: number, val: string) => {
    const next = values.slice();
    next[i] = val;
    setValues(next);
  };

  return (
    <div className="mt-2 rounded-md bg-zinc-50 border border-zinc-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs text-zinc-700"
      >
        <span>
          {label}:{" "}
          <span className="font-medium tabular-nums">
            {formatNum(sum)} {unit}
          </span>
        </span>
        <span className="text-zinc-400">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {values.map((v, i) => (
            <input
              key={i}
              type="text"
              inputMode="decimal"
              placeholder={`partia ${i + 1} (${unit})`}
              value={v}
              disabled={pending}
              onChange={(e) => updateAt(i, e.target.value)}
              onBlur={() => save(values)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums focus:outline-none focus:border-accent"
            />
          ))}
          <p className="text-xs text-zinc-600 text-right">
            Suma:{" "}
            <span className="font-semibold tabular-nums">
              {formatNum(sum)} {unit}
            </span>
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

function parseNum(s: string): number {
  if (!s.trim()) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}
