"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  CHECKLIST_STATUSES,
  CHECKLIST_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type ChecklistItem,
  type ChecklistItemStatus,
  type ProjectType,
} from "@/lib/dao/job_checklist.types";
import {
  addChecklistItemAction,
  updateChecklistItemAction,
  setChecklistItemStatusAction,
  deleteChecklistItemAction,
  seedChecklistAction,
} from "./checklistActions";
import { fmtPLN } from "@/lib/format";

const STATUS_BG: Record<ChecklistItemStatus, string> = {
  pending: "bg-zinc-100 text-zinc-700 border-zinc-200",
  ordered: "bg-amber-100 text-amber-700 border-amber-200",
  delivered: "bg-blue-100 text-blue-700 border-blue-200",
  installed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function JobChecklist({
  jobId,
  projectType,
  items,
}: {
  jobId: string;
  projectType: ProjectType | null;
  items: ChecklistItem[];
}) {
  const groups = new Map<string, ChecklistItem[]>();
  for (const it of items) {
    const arr = groups.get(it.category) ?? [];
    arr.push(it);
    groups.set(it.category, arr);
  }

  const [adding, setAdding] = useState(false);

  const total = items.length;
  const installed = items.filter((i) => i.status === "installed").length;

  return (
    <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-zinc-700">
          Checklist projektu
          {projectType ? ` — ${PROJECT_TYPE_LABELS[projectType]}` : ""}
        </h2>
        {total > 0 && (
          <span className="text-[11px] text-zinc-500">
            {installed} / {total} zamontowane
          </span>
        )}
      </div>

      {total === 0 && projectType && <SeedButton jobId={jobId} projectType={projectType} />}

      {total === 0 && !projectType && (
        <p className="text-sm text-zinc-500 mb-3">
          Wybierz typ projektu w edycji zlecenia, aby wczytać szablon — lub dodaj pozycje ręcznie.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {Array.from(groups.entries()).map(([category, catItems]) => (
          <div key={category}>
            <h3 className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-1">
              {category}
            </h3>
            <ul className="flex flex-col divide-y divide-zinc-100 border border-zinc-100 rounded-lg">
              {catItems.map((item) => (
                <ChecklistRow key={item.id} item={item} jobId={jobId} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-100">
        {adding ? (
          <AddItemForm jobId={jobId} onClose={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-sm text-[#282624] underline-offset-2 hover:underline"
          >
            + Dodaj pozycję
          </button>
        )}
      </div>
    </section>
  );
}

function SeedButton({ jobId, projectType }: { jobId: string; projectType: ProjectType }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await seedChecklistAction(jobId, formData);
        });
      }}
      className="mb-3"
    >
      <input type="hidden" name="project_type" value={projectType} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Wczytuję..." : `Wczytaj szablon — ${PROJECT_TYPE_LABELS[projectType]}`}
      </button>
    </form>
  );
}

function ChecklistRow({ item, jobId }: { item: ChecklistItem; jobId: string }) {
  const [open, setOpen] = useState(false);
  const [statusPending, startStatusTransition] = useTransition();
  const [status, setStatus] = useState<ChecklistItemStatus>(item.status);
  useEffect(() => {
    setStatus(item.status);
  }, [item.status]);
  const totalNet = item.unit_price_net !== null ? item.qty * item.unit_price_net : null;

  return (
    <li className="px-2 py-2">
      <div className="flex items-center gap-2">
        <select
          value={status}
          disabled={statusPending}
          onChange={(e) => {
            const next = e.currentTarget.value as ChecklistItemStatus;
            setStatus(next);
            startStatusTransition(async () => {
              try {
                await setChecklistItemStatusAction(item.id, jobId, next);
              } catch {
                setStatus(item.status);
              }
            });
          }}
          className={`text-[11px] font-medium px-2 py-1 rounded-full border ${STATUS_BG[status]} cursor-pointer focus:outline-none disabled:opacity-60`}
        >
          {CHECKLIST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CHECKLIST_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left flex items-baseline gap-2 min-w-0"
        >
          <span className="text-sm text-zinc-900 truncate">{item.label}</span>
          <span className="text-[11px] text-zinc-500 shrink-0">
            {fmtQty(item.qty)} {item.unit}
          </span>
          {totalNet !== null && (
            <span className="text-[11px] text-zinc-500 shrink-0">· {fmtPLN(totalNet)}</span>
          )}
          {item.counts_in_margin && (
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 shrink-0">
              w marży
            </span>
          )}
        </button>
      </div>
      {open && <EditItemForm item={item} jobId={jobId} onClose={() => setOpen(false)} />}
    </li>
  );
}

function AddItemForm({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const res = await addChecklistItemAction(jobId, { error: undefined }, formData);
          if (res.error) setError(res.error);
          else {
            setError(undefined);
            onClose();
          }
        });
      }}
      className="flex flex-col gap-2 bg-zinc-50 border border-zinc-200 rounded-lg p-3"
    >
      <ItemFields />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Dodaję..." : "Dodaj"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-300 text-zinc-700 px-3 py-2 text-sm"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

function EditItemForm({
  item,
  jobId,
  onClose,
}: {
  item: ChecklistItem;
  jobId: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const res = await updateChecklistItemAction(item.id, jobId, { error: undefined }, formData);
          if (res.error) setError(res.error);
          else {
            setError(undefined);
            onClose();
          }
        });
      }}
      className="mt-2 flex flex-col gap-2 bg-zinc-50 border border-zinc-200 rounded-lg p-3"
    >
      <ItemFields initial={item} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Zapisuję..." : "Zapisz"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-300 text-zinc-700 px-3 py-2 text-sm"
        >
          Anuluj
        </button>
        <DeleteItemButton itemId={item.id} jobId={jobId} />
      </div>
    </form>
  );
}

function ItemFields({ initial }: { initial?: ChecklistItem }) {
  const vatPctInitial = initial ? Math.round(initial.vat_rate * 100).toString() : "23";
  return (
    <>
      <Field label="Kategoria">
        <input
          name="category"
          required
          defaultValue={initial?.category ?? ""}
          className={inputCls}
        />
      </Field>
      <Field label="Pozycja">
        <input name="label" required defaultValue={initial?.label ?? ""} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ilość">
          <input
            name="qty"
            inputMode="decimal"
            defaultValue={initial ? fmtQty(initial.qty) : "1"}
            className={inputCls}
          />
        </Field>
        <Field label="Jednostka">
          <input name="unit" defaultValue={initial?.unit ?? "szt"} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Cena netto / jedn.">
          <input
            name="unit_price_net"
            inputMode="decimal"
            placeholder="0"
            defaultValue={
              initial?.unit_price_net != null ? fmtQty(initial.unit_price_net) : ""
            }
            className={inputCls}
          />
        </Field>
        <Field label="VAT (%)">
          <select name="vat_rate" defaultValue={vatPctInitial} className={inputCls}>
            <option value="23">23%</option>
            <option value="8">8%</option>
            <option value="5">5%</option>
            <option value="0">0%</option>
          </select>
        </Field>
      </div>
      <Field label="Dostawca">
        <input name="supplier" defaultValue={initial?.supplier ?? ""} className={inputCls} />
      </Field>
      <Field label="Notatki">
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ""}
          className={inputCls}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="counts_in_margin"
          defaultChecked={initial?.counts_in_margin ?? false}
        />
        <span>Wlicz w marżę zlecenia</span>
      </label>
    </>
  );
}

function DeleteItemButton({ itemId, jobId }: { itemId: string; jobId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Usunąć pozycję?")) return;
        startTransition(async () => {
          await deleteChecklistItemAction(itemId, jobId);
        });
      }}
      className="ml-auto text-sm text-red-600 px-2 py-2 disabled:opacity-50"
    >
      {pending ? "Usuwam..." : "Usuń"}
    </button>
  );
}

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-2 py-2 text-sm focus:outline-none focus:border-accent w-full";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

function fmtQty(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toString().replace(".", ",");
}
