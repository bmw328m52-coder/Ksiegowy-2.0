"use client";

import { useActionState, useState } from "react";
import type { CostLine } from "@/lib/dao/cost_lines.types";
import { COST_CATEGORIES } from "@/lib/dao/cost_lines.types";
import {
  assignCostLineAction,
  assignCostLineCatalogAction,
  deleteCostLineAction,
  updateCostLineAction,
} from "./actions";
import { fmtPLN } from "@/lib/format";

type Action = (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;

type JobOption = { id: string; title: string; client_name: string };
type CatalogOption = { id: string; name: string; unit: string; category: string | null };

export default function CostLineCard({
  line,
  invoiceId,
  jobs,
  catalog,
}: {
  line: CostLine;
  invoiceId: string;
  jobs: JobOption[];
  catalog: CatalogOption[];
}) {
  const [editing, setEditing] = useState(false);
  const updateAction: Action = updateCostLineAction.bind(null, line.id, invoiceId);
  const [state, formAction, pending] = useActionState(updateAction, { error: undefined });
  const assignBound = assignCostLineAction.bind(null, line.id);
  const assignCatalogBound = assignCostLineCatalogAction.bind(null, line.id);
  const deleteBound = deleteCostLineAction.bind(null, line.id, invoiceId);

  const qtyNum = Number(line.qty) || 1;
  const grossNum = Number(line.amount_gross) || 0;
  const unitPriceGross = qtyNum > 0 ? grossNum / qtyNum : grossNum;
  const catalogGroups = groupByCategory(catalog);

  const vatPct =
    line.vat_rate !== null && line.vat_rate !== undefined
      ? Math.round(Number(line.vat_rate) * 100).toString()
      : "";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 flex flex-col gap-2">
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{line.description}</p>
              <p className="text-xs text-zinc-500">
                {line.category ?? "—"} • {fmtPLN(line.amount_net)} netto + VAT
              </p>
            </div>
            <span className="font-semibold text-sm shrink-0">{fmtPLN(line.amount_gross)}</span>
          </div>

          <form action={assignBound} className="flex items-center gap-2">
            <input type="hidden" name="invoice_id" value={invoiceId} />
            <label className="text-xs text-zinc-600 shrink-0">Zlecenie:</label>
            <select
              name="job_id"
              defaultValue={line.job_id ?? "__none__"}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="flex-1 rounded-md border border-zinc-300 bg-white text-zinc-900 px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
            >
              <option value="__none__">— koszt ogólny —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.client_name})
                </option>
              ))}
            </select>
          </form>

          <form action={assignCatalogBound} className="flex flex-col gap-1.5 rounded-md bg-zinc-50 border border-zinc-200 p-2">
            <input type="hidden" name="invoice_id" value={invoiceId} />
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-600 shrink-0">Katalog:</label>
              <select
                name="catalog_id"
                defaultValue={line.catalog_id ?? "__none__"}
                className="flex-1 rounded-md border border-zinc-300 bg-white text-zinc-900 px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
              >
                <option value="__none__">— nie spinaj —</option>
                {catalogGroups.map(({ category, items }) => (
                  <optgroup key={category} label={category}>
                    {items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.unit})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-600 shrink-0">Ilość:</label>
              <input
                name="qty"
                inputMode="decimal"
                defaultValue={qtyNum}
                className="w-20 rounded-md border border-zinc-300 bg-white text-zinc-900 px-2 py-1.5 text-xs text-right tabular-nums focus:outline-none focus:border-accent"
              />
              <span className="text-[11px] text-zinc-500 flex-1 truncate">
                = <strong>{fmtPLN(unitPriceGross)}</strong>/szt brutto
              </span>
              <button
                type="submit"
                className="text-[11px] px-2.5 py-1.5 rounded-md bg-accent text-white font-medium active:opacity-80"
              >
                Spnij
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-600">
              <input
                type="checkbox"
                name="update_price"
                defaultChecked
                className="accent-[#a06f3f]"
              />
              Aktualizuj cenę w cenniku z tej faktury
            </label>
            {line.catalog_id && (
              <p className="text-[10px] text-emerald-700">
                ✓ Spięte z cennikiem
              </p>
            )}
          </form>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 rounded-md border border-zinc-200 text-xs py-1.5 active:bg-zinc-50"
            >
              Edytuj
            </button>
            <form action={deleteBound}>
              <button
                type="submit"
                onClick={(e) => {
                  if (!confirm("Usunąć tę pozycję kosztową?")) e.preventDefault();
                }}
                className="rounded-md border border-red-200 text-red-600 text-xs px-3 py-1.5 active:bg-red-50"
              >
                Usuń
              </button>
            </form>
          </div>
        </>
      ) : (
        <form action={formAction} className="flex flex-col gap-2">
          <Field label="Opis">
            <input name="description" required defaultValue={line.description} className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Netto">
              <input name="amount_net" inputMode="decimal" defaultValue={line.amount_net} className={inputCls} />
            </Field>
            <Field label="VAT zł">
              <input name="amount_vat" inputMode="decimal" defaultValue={line.amount_vat} className={inputCls} />
            </Field>
            <Field label="Brutto">
              <input
                name="amount_gross"
                inputMode="decimal"
                required
                defaultValue={line.amount_gross}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ilość">
              <input
                name="qty"
                inputMode="decimal"
                defaultValue={qtyNum}
                className={inputCls}
              />
            </Field>
            <Field label="Data">
              <input type="date" name="cost_date" defaultValue={line.cost_date} className={inputCls} />
            </Field>
          </div>
          <Field label="VAT %">
            <select name="vat_rate" defaultValue={vatPct} className={inputCls}>
              <option value="">—</option>
              <option value="23">23%</option>
              <option value="8">8%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </Field>
          <Field label="Kategoria">
            <select name="category" defaultValue={line.category ?? ""} className={inputCls}>
              <option value="">—</option>
              {COST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          {state.error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
              {state.error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-md bg-accent text-white text-xs py-2 font-medium active:opacity-80 disabled:opacity-50"
            >
              {pending ? "Zapisuję..." : "Zapisz"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-zinc-200 text-xs px-3 py-2 active:bg-zinc-50"
            >
              Anuluj
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-2 py-1.5 text-sm focus:outline-none focus:border-accent w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function groupByCategory(
  items: CatalogOption[]
): { category: string; items: CatalogOption[] }[] {
  const map = new Map<string, CatalogOption[]>();
  for (const c of items) {
    const key = c.category ?? "Bez kategorii";
    const arr = map.get(key) ?? [];
    arr.push(c);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "pl"))
    .map(([category, items]) => ({ category, items }));
}
