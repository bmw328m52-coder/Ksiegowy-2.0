"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JobMaterial, MaterialCatalogItem } from "@/lib/dao/material_catalog";
import {
  addJobMaterialAction,
  deleteJobMaterialAction,
  updateJobMaterialQtyAction,
} from "@/app/materials/actions";
import { fmtPLN, parseAmount } from "@/lib/format";
import { humanizeSupabaseError } from "@/lib/supabaseError";
import { useGroupItems, useMaterialsStore } from "./MaterialsStore";

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent w-full";

export default function GroupMaterialsPicker({
  jobId,
  groupKey,
  groupLabel,
  displayKeys,
  catalog,
  suggestedCategories,
}: {
  jobId: string;
  groupKey: string;
  groupLabel: string;
  displayKeys: string[];
  catalog: MaterialCatalogItem[];
  suggestedCategories: string[];
}) {
  const [adding, setAdding] = useState(false);
  // Lista czytana ze wspólnego store — dodanie/usunięcie/zmiana ilości widać OD RAZU.
  const items = useGroupItems(displayKeys);
  const total = items.reduce(
    (acc, m) => (m.unit_price_gross === null ? acc : acc + m.qty * m.unit_price_gross),
    0
  );
  const missingPrice = items.some((m) => m.unit_price_gross === null);

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((m) => (
            <MaterialRow key={m.id} m={m} jobId={jobId} />
          ))}
        </ul>
      )}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start text-xs text-[#a06f3f] underline-offset-2 hover:underline"
        >
          + Z cennika
        </button>
      ) : (
        <AddForm
          jobId={jobId}
          groupKey={groupKey}
          groupLabel={groupLabel}
          catalog={catalog}
          suggestedCategories={suggestedCategories}
          onDone={() => setAdding(false)}
        />
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100">
        <span className="text-xs text-zinc-500">
          Suma{missingPrice && " (bez pozycji bez ceny)"}
        </span>
        <span className="text-sm font-semibold tabular-nums">{fmtPLN(total)}</span>
      </div>
    </div>
  );
}

function MaterialRow({ m, jobId }: { m: JobMaterial; jobId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const { remove, add, updateQty } = useMaterialsStore();
  const unit = m.unit_price_gross;
  const lineTotal = unit !== null ? m.qty * unit : null;

  return (
    <li className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium break-words" title={m.name}>{m.name}</p>
          {!editing ? (
            <p className="text-xs text-zinc-500">
              {formatQty(m.qty)} {m.unit}
              {unit !== null && (
                <>
                  {" "}× <span className="tabular-nums">{fmtPLN(unit)}</span>
                </>
              )}
              {unit === null && <span className="text-amber-700"> — brak ceny</span>}
            </p>
          ) : (
            <form
              action={async (formData) => {
                const qty = parseAmount(String(formData.get("qty") ?? ""));
                const prevQty = m.qty;
                if (qty !== null && qty > 0) updateQty(m.id, qty); // optymistycznie
                setEditing(false);
                try {
                  await updateJobMaterialQtyAction(m.id, jobId, formData);
                } catch {
                  updateQty(m.id, prevQty); // błąd — przywróć
                }
                startTransition(() => router.refresh());
              }}
              className="mt-1 flex items-center gap-2"
            >
              <input
                name="qty"
                inputMode="decimal"
                defaultValue={formatQty(m.qty)}
                className={inputCls}
                style={{ width: "80px" }}
              />
              <span className="text-xs text-zinc-500">{m.unit}</span>
              <button type="submit" className="text-xs bg-accent text-white px-2 py-1 rounded-md">
                OK
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs text-zinc-500 px-2 py-1"
              >
                Anuluj
              </button>
            </form>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            {lineTotal !== null && (
              <span className="text-sm font-semibold tabular-nums text-zinc-900 pr-1">
                {fmtPLN(lineTotal)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-600 px-2 py-1 rounded-md active:bg-zinc-100"
            >
              Edytuj
            </button>
            <form
              action={async () => {
                remove(m.id); // ukryj od razu
                try {
                  await deleteJobMaterialAction(m.id, jobId);
                } catch {
                  add(m); // błąd — przywróć wiersz
                }
                startTransition(() => router.refresh());
              }}
            >
              <button type="submit" className="text-xs text-red-600 px-2 py-1 rounded-md active:bg-red-50">
                Usuń
              </button>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}

function AddForm({
  jobId,
  groupKey,
  groupLabel,
  catalog,
  suggestedCategories,
  onDone,
}: {
  jobId: string;
  groupKey: string;
  groupLabel: string;
  catalog: MaterialCatalogItem[];
  suggestedCategories: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { add } = useMaterialsStore();
  const [error, setError] = useState<string | undefined>();
  const [mode, setMode] = useState<"catalog" | "manual">("catalog");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MaterialCatalogItem | null>(null);
  const [qty, setQty] = useState("1");

  const sugSet = useMemo(() => new Set(suggestedCategories), [suggestedCategories]);

  // Wyniki filtrowane po nazwie/kategorii/dostawcy; sugerowane kategorie na górze.
  const results = useMemo(() => {
    const q = norm(query.trim());
    const list = q
      ? catalog.filter((c) =>
          norm(`${c.name} ${c.category ?? ""} ${c.supplier ?? ""}`).includes(q)
        )
      : catalog.slice();
    return list.sort((a, b) => {
      const as = a.category && sugSet.has(a.category) ? 0 : 1;
      const bs = b.category && sugSet.has(b.category) ? 0 : 1;
      if (as !== bs) return as - bs;
      return a.name.localeCompare(b.name, "pl");
    });
  }, [catalog, query, sugSet]);

  if (catalog.length === 0) {
    return (
      <p className="text-xs text-zinc-500 py-2">
        Cennik jest pusty.{" "}
        <Link href="/materials" className="underline">
          Dodaj pozycje
        </Link>
        .
      </p>
    );
  }

  const LIMIT = 50;

  return (
    <form
      action={async (formData) => {
        setError(undefined);
        formData.set("group_key", groupKey);
        if (mode === "manual") {
          formData.delete("catalog_id");
          const name = String(formData.get("name") ?? "").trim();
          if (!name) {
            setError("Podaj nazwę pozycji.");
            return;
          }
          const price = String(formData.get("unit_price_gross") ?? "").trim();
          if (!price) {
            setError("Podaj cenę.");
            return;
          }
          formData.set("qty", "1");
        } else {
          if (!selected) {
            setError("Wybierz materiał z listy.");
            return;
          }
          formData.set("catalog_id", selected.id);
          formData.set("qty", qty);
        }
        try {
          const created = await addJobMaterialAction(jobId, formData);
          add(created); // pokaż od razu
          onDone();
          startTransition(() => router.refresh());
        } catch (e) {
          setError(humanizeSupabaseError(e));
        }
      }}
      className="flex flex-col gap-2 border border-zinc-200 rounded-md p-2.5 bg-zinc-50"
    >
      <p className="text-[11px] text-zinc-500">Dodaj do: {groupLabel}</p>

      <div className="flex gap-1 p-1 rounded-md bg-white border border-zinc-200 text-xs">
        <button
          type="button"
          onClick={() => setMode("catalog")}
          className={`flex-1 py-1 rounded ${mode === "catalog" ? "bg-accent text-white" : "text-zinc-600"}`}
        >
          Z cennika
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 py-1 rounded ${mode === "manual" ? "bg-accent text-white" : "text-zinc-600"}`}
        >
          Ręczna kwota
        </button>
      </div>

      {mode === "manual" ? (
        <>
          <input
            name="name"
            autoFocus
            placeholder="Nazwa, np. Materiał korpusy + blat (Zimex)"
            className={inputCls}
          />
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <input
              name="unit_price_gross"
              inputMode="decimal"
              placeholder="Cena łączna brutto"
              className={inputCls}
            />
            <span className="text-xs text-zinc-500">zł</span>
          </div>
          <input type="hidden" name="unit" value="kpl" />
          <p className="text-[11px] text-zinc-400">
            Jedna pozycja z Twoją ceną — bez liczenia z cennika.
          </p>
        </>
      ) : !selected ? (
        <>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (results.length > 0) setSelected(results[0]);
              }
            }}
            placeholder="Szukaj: nazwa, kod Blum, dostawca…"
            className={inputCls}
          />
          <ul className="max-h-60 overflow-y-auto flex flex-col gap-1 rounded-md border border-zinc-200 bg-white p-1">
            {results.length === 0 ? (
              <li className="text-xs text-zinc-500 px-2 py-2">Brak dopasowań.</li>
            ) : (
              results.slice(0, LIMIT).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className="w-full text-left rounded-md px-2 py-1.5 active:bg-zinc-100 hover:bg-zinc-50"
                  >
                    <span className="block text-sm break-words">{c.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {c.category ? `[${c.category}] ` : ""}
                      {c.unit}
                      {c.default_price_gross !== null
                        ? ` · ${fmtPLN(c.default_price_gross)}`
                        : " · brak ceny"}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {results.length > LIMIT && (
            <p className="text-[11px] text-zinc-400">
              Pokazano {LIMIT} z {results.length} — doprecyzuj wyszukiwanie.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 rounded-md border border-zinc-200 bg-white p-2">
            <div className="min-w-0">
              <p className="text-sm font-medium break-words">{selected.name}</p>
              <p className="text-xs text-zinc-500">
                {selected.unit}
                {selected.default_price_gross !== null
                  ? ` · ${fmtPLN(selected.default_price_gross)}`
                  : " · brak ceny"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setQuery("");
              }}
              className="shrink-0 text-xs text-[#a06f3f] underline-offset-2 hover:underline"
            >
              zmień
            </button>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <input
              name="qty"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Ilość"
              required
              className={inputCls}
            />
            <span className="text-xs text-zinc-500">{selected.unit}</span>
          </div>
        </>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mode === "catalog" && !selected}
          className="flex-1 rounded-md bg-accent text-white py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Dodaj
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-zinc-300 px-3 text-sm text-zinc-600"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

// Normalizacja do wyszukiwania: małe litery + bez polskich znaków.
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toString().replace(".", ",");
}
