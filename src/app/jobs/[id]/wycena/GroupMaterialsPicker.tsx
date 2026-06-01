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
import { fmtPLN } from "@/lib/format";

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent w-full";

export default function GroupMaterialsPicker({
  jobId,
  groupKey,
  groupLabel,
  items,
  catalog,
  suggestedCategories,
}: {
  jobId: string;
  groupKey: string;
  groupLabel: string;
  items: JobMaterial[];
  catalog: MaterialCatalogItem[];
  suggestedCategories: string[];
}) {
  const [adding, setAdding] = useState(false);
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
  const unit = m.unit_price_gross;
  const lineTotal = unit !== null ? m.qty * unit : null;

  return (
    <li className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{m.name}</p>
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
                await updateJobMaterialQtyAction(m.id, jobId, formData);
                setEditing(false);
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
                await deleteJobMaterialAction(m.id, jobId);
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
  const [error, setError] = useState<string | undefined>();

  const { suggested, other } = useMemo(() => {
    const sugSet = new Set(suggestedCategories);
    const suggested: MaterialCatalogItem[] = [];
    const other: MaterialCatalogItem[] = [];
    for (const c of catalog) {
      if (c.category && sugSet.has(c.category)) suggested.push(c);
      else other.push(c);
    }
    return { suggested, other };
  }, [catalog, suggestedCategories]);

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

  return (
    <form
      action={async (formData) => {
        setError(undefined);
        formData.set("group_key", groupKey);
        try {
          await addJobMaterialAction(jobId, formData);
          onDone();
          startTransition(() => router.refresh());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Nieznany błąd.");
        }
      }}
      className="flex flex-col gap-2 border border-zinc-200 rounded-md p-2.5 bg-zinc-50"
    >
      <p className="text-[11px] text-zinc-500">Dodaj do: {groupLabel}</p>
      <select name="catalog_id" required className={inputCls} defaultValue="">
        <option value="" disabled>
          — wybierz materiał —
        </option>
        {suggested.length > 0 && (
          <optgroup label="Sugerowane">
            {suggested.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.unit}
                {c.default_price_gross !== null ? ` · ${fmtPLN(c.default_price_gross)}` : ""}
                )
              </option>
            ))}
          </optgroup>
        )}
        {other.length > 0 && (
          <optgroup label={suggested.length > 0 ? "Pozostałe" : "Cennik"}>
            {other.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category ? `[${c.category}] ` : ""}
                {c.name} ({c.unit}
                {c.default_price_gross !== null ? ` · ${fmtPLN(c.default_price_gross)}` : ""}
                )
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
        <input
          name="qty"
          inputMode="decimal"
          defaultValue="1"
          placeholder="Ilość"
          required
          className={inputCls}
        />
        <span className="text-xs text-zinc-500">ilość</span>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-md bg-accent text-white py-1.5 text-sm font-medium"
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

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toString().replace(".", ",");
}
