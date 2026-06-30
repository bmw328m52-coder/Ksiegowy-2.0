"use client";

import { useActionState } from "react";
import { UNITS } from "@/lib/units";
import { SUPPLIERS } from "@/lib/suppliers";
import { createCatalogAction } from "./actions";

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent w-full";

export default function AddCatalogForm() {
  const [state, formAction, pending] = useActionState(createCatalogAction, { error: undefined });

  return (
    <form
      action={formAction}
      className="rounded-xl border border-zinc-200 bg-white p-3 flex flex-col gap-2"
    >
      <input name="name" required placeholder="Nazwa (np. Zawias Blum Clip Top)" className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <select name="unit" defaultValue="szt" className={inputCls}>
          {UNITS.map((u) => (
            <option key={u.code} value={u.code}>
              {u.label}
            </option>
          ))}
        </select>
        <input
          name="default_price_gross"
          inputMode="decimal"
          placeholder="Cena brutto"
          className={inputCls}
        />
        <input name="category" placeholder="Kategoria" className={inputCls} />
      </div>
      <select name="supplier" defaultValue="" className={inputCls}>
        <option value="">Dostawca — auto z kategorii</option>
        {SUPPLIERS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input name="notes" placeholder="Notatka (opcjonalnie)" className={inputCls} />
      {state.error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Dodaję..." : "+ Dodaj do katalogu"}
      </button>
    </form>
  );
}
