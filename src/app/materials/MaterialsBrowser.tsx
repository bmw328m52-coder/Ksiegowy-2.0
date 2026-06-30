"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { resolveSupplier } from "@/lib/suppliers";
import { fmtPLN } from "@/lib/format";
import type { MaterialCatalogItem } from "@/lib/dao/material_catalog";
import { deleteCatalogAction } from "./actions";

const NO_CAT = "Bez kategorii";

const controlCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent w-full";

export default function MaterialsBrowser({ items }: { items: MaterialCatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.category ?? NO_CAT);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
  }, [items]);

  // Filtr po nazwie/kategorii/dostawcy + opcjonalnie wybrana kategoria.
  const grouped = useMemo(() => {
    const q = norm(query.trim());
    const map = new Map<string, MaterialCatalogItem[]>();
    for (const it of items) {
      const cat = it.category ?? NO_CAT;
      if (category && cat !== category) continue;
      if (q && !norm(`${it.name} ${it.category ?? ""} ${it.supplier ?? ""}`).includes(q)) continue;
      const arr = map.get(cat) ?? [];
      arr.push(it);
      map.set(cat, arr);
    }
    return Array.from(map.entries());
  }, [items, query, category]);

  const matchCount = useMemo(
    () => grouped.reduce((acc, [, list]) => acc + list.length, 0),
    [grouped]
  );

  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500 py-10">
        Cennik jest pusty. Dodaj pierwszą pozycję powyżej.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj: nazwa, kod Blum, dostawca…"
          className={controlCls}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={controlCls}
        >
          <option value="">Wszystkie kategorie ({items.length})</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {matchCount === 0 ? (
        <p className="text-center text-sm text-zinc-500 py-10">
          Brak dopasowań{query ? ` do „${query.trim()}”` : ""}.
        </p>
      ) : (
        <div className="flex flex-col gap-5 mt-4">
          {grouped.map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-2">
                {cat} <span className="text-zinc-400 normal-case">· {list.length}</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((it) => {
                  const del = deleteCatalogAction.bind(null, it.id);
                  const supplier = resolveSupplier(it.supplier, it.category, it.name);
                  return (
                    <li
                      key={it.id}
                      className="rounded-xl border border-zinc-200 bg-white p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <p className="font-medium break-words" title={it.name}>
                            {it.name}
                          </p>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5 mt-0.5">
                            {supplier}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {it.unit}
                          {it.default_price_gross !== null &&
                            ` • ${fmtPLN(it.default_price_gross)}/${it.unit}`}
                        </p>
                        {it.notes && (
                          <p className="text-xs text-zinc-500 mt-0.5">{it.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/materials/${it.id}/edit`}
                          className="text-xs text-zinc-600 px-2 py-1 rounded-md active:bg-zinc-50"
                        >
                          Edytuj
                        </Link>
                        <form action={del}>
                          <ConfirmSubmitButton
                            message={`Usunąć "${it.name}" z katalogu?`}
                            formNoValidate
                            className="text-xs text-red-600 px-2 py-1 rounded-md active:bg-red-50"
                          >
                            Usuń
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// Normalizacja do wyszukiwania: małe litery + bez polskich znaków diakrytycznych.
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
