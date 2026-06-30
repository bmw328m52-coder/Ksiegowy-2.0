"use client";

import { useState, useTransition } from "react";
import { fmtPLN } from "@/lib/format";
import { saveAutopriceBindingAction } from "./actions";

type Slot = {
  key: string;
  label: string;
  section: string;
  preferredCategories: string[];
};

type CatItem = {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  default_price_gross: number | null;
};

export default function AutopriceForm({
  slots,
  catalog,
  current,
}: {
  slots: Slot[];
  catalog: CatItem[];
  current: Record<string, string>;
}) {
  const sections = Array.from(new Set(slots.map((s) => s.section)));

  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <section key={section}>
          <h2 className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-2">
            {section}
          </h2>
          <ul className="flex flex-col gap-2">
            {slots
              .filter((s) => s.section === section)
              .map((s) => (
                <SlotRow
                  key={s.key}
                  slot={s}
                  catalog={catalog}
                  initial={current[s.key] ?? ""}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SlotRow({
  slot,
  catalog,
  initial,
}: {
  slot: Slot;
  catalog: CatItem[];
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const sugSet = new Set(slot.preferredCategories);
  const suggested = catalog.filter((c) => c.category && sugSet.has(c.category));
  const other = catalog.filter((c) => !(c.category && sugSet.has(c.category)));

  const onChange = (next: string) => {
    setValue(next);
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const res = await saveAutopriceBindingAction(slot.key, next);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  };

  const label = (c: CatItem) =>
    `${c.name} (${c.unit}${c.default_price_gross !== null ? ` · ${fmtPLN(c.default_price_gross)}` : " · brak ceny"})`;

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-zinc-800">{slot.label}</span>
        {pending ? (
          <span className="text-[11px] text-zinc-400">zapisuję…</span>
        ) : saved ? (
          <span className="text-[11px] text-emerald-600">zapisano ✓</span>
        ) : null}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-300 bg-white text-zinc-900 px-3 py-2 text-sm focus:outline-none focus:border-accent"
      >
        <option value="">— brak (nie wyceniaj automatycznie) —</option>
        {suggested.length > 0 && (
          <optgroup label="Sugerowane">
            {suggested.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c)}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label={suggested.length > 0 ? "Pozostałe" : "Cennik"}>
          {other.map((c) => (
            <option key={c.id} value={c.id}>
              {c.category ? `[${c.category}] ` : ""}
              {label(c)}
            </option>
          ))}
        </optgroup>
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </li>
  );
}
