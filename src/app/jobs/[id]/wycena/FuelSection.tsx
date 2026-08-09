"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFuelAction } from "@/app/materials/actions";
import { fmtPLN } from "@/lib/format";
import { useFuelItem, useMaterialsStore } from "./MaterialsStore";

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent w-full";

// Kwota do pola input (kropka → przecinek, bez zbędnych zer).
function toInput(n: number | null): string {
  if (n === null) return "";
  return Number.isInteger(n) ? String(n) : n.toString().replace(".", ",");
}

export default function FuelSection({ jobId }: { jobId: string }) {
  const fuel = useFuelItem();
  const { upsert, remove } = useMaterialsStore();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const current = fuel?.unit_price_gross ?? null;

  return (
    <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-700">Paliwo / dojazd</h2>
        {current !== null && (
          <span className="text-sm font-semibold tabular-nums">{fmtPLN(current)}</span>
        )}
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        Koszt dojazdu — wliczany do kosztów wyceny. Zostaw puste, jeśli nie dotyczy.
      </p>
      <form
        action={async (formData) => {
          setError(undefined);
          setSaving(true);
          const raw = String(formData.get("fuel") ?? "");
          try {
            const res = await setFuelAction(jobId, fuel?.id ?? null, raw);
            if (res) upsert(res);
            else if (fuel) remove(fuel.id);
            startTransition(() => router.refresh());
          } catch (e) {
            setError(e instanceof Error ? e.message : "Nieznany błąd.");
          } finally {
            setSaving(false);
          }
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            key={current ?? "empty"}
            name="fuel"
            inputMode="decimal"
            defaultValue={toInput(current)}
            placeholder="0"
            className={`${inputCls} pr-9`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
            zł
          </span>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium active:opacity-80 disabled:opacity-50"
        >
          Zapisz
        </button>
      </form>
      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
          {error}
        </p>
      )}
    </section>
  );
}
