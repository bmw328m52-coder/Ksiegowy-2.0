"use client";

import { useState, useTransition } from "react";
import { setItemPriceAction } from "./actions";

export default function PriceInput({
  briefId,
  jobId,
  fieldKey,
  initial,
}: {
  briefId: string;
  jobId: string;
  fieldKey: string;
  initial: number | null;
}) {
  const [value, setValue] = useState<string>(initial === null ? "" : formatInitial(initial));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (raw: string) => {
    const normalized = raw.trim();
    const current = initial === null ? "" : formatInitial(initial);
    if (normalized === current) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("price", normalized);
        await setItemPriceAction(briefId, jobId, fieldKey, fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd zapisu.");
      }
    });
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder="—"
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        className={`w-20 rounded-md border px-2 py-1 text-right text-sm tabular-nums focus:outline-none ${
          error
            ? "border-red-300 bg-red-50"
            : "border-zinc-300 bg-white focus:border-accent"
        } disabled:opacity-60`}
      />
      <span className="text-xs text-zinc-400">zł</span>
    </div>
  );
}

function formatInitial(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}
