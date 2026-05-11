"use client";

import { useActionState, useState } from "react";
import type { Job, JobStatus } from "@/lib/dao/jobs.types";
import { JOB_STATUS_LABELS } from "@/lib/dao/jobs.types";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type ProjectType,
} from "@/lib/dao/job_checklist.types";

type Action = (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;

export default function JobForm({
  action,
  clientId,
  clientName,
  initial,
  submitLabel,
}: {
  action: Action;
  clientId: string;
  clientName: string;
  initial?: Partial<Job>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: undefined });
  const vatPctInitial = initial?.vat_rate
    ? Math.round(Number(initial.vat_rate) * 100).toString()
    : "23";

  return (
    <form action={formAction} className="w-full flex flex-col gap-4">
      <input type="hidden" name="client_id" value={clientId} />

      <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm">
        <span className="text-zinc-500">Klient: </span>
        <span className="font-medium">{clientName}</span>
      </div>

      <Field label="Tytuł zlecenia" required>
        <input
          name="title"
          required
          placeholder="np. Szafa wnękowa — sypialnia"
          defaultValue={initial?.title ?? ""}
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kwota brutto (PLN)" required>
          <input
            name="amount_gross"
            inputMode="decimal"
            required
            placeholder="12500"
            defaultValue={initial?.amount_gross ?? ""}
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

      <Field label="Status">
        <select
          name="status"
          defaultValue={(initial?.status as JobStatus) ?? "planned"}
          className={inputCls}
        >
          {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((s) => (
            <option key={s} value={s}>
              {JOB_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Typ projektu (checklist)">
        <select
          name="project_type"
          defaultValue={(initial?.project_type as ProjectType) ?? ""}
          className={inputCls}
        >
          <option value="">— brak —</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROJECT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-zinc-500">
          Po wyborze typu zlecenie dostanie automatycznie checklist startowy do edycji.
        </span>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data startu">
          <input
            type="date"
            name="start_date"
            defaultValue={initial?.start_date ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Termin">
          <input
            type="date"
            name="due_date"
            defaultValue={initial?.due_date ?? ""}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data zakończenia">
          <input
            type="date"
            name="completed_date"
            defaultValue={initial?.completed_date ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Data zapłaty">
          <input
            type="date"
            name="paid_date"
            defaultValue={initial?.paid_date ?? ""}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Zaliczka / zadatek (PLN)">
          <input
            name="deposit_amount"
            inputMode="decimal"
            placeholder="0"
            defaultValue={
              initial?.deposit_amount && Number(initial.deposit_amount) > 0
                ? String(initial.deposit_amount)
                : ""
            }
            className={inputCls}
          />
        </Field>
        <Field label="Data zaliczki">
          <input
            type="date"
            name="deposit_date"
            defaultValue={initial?.deposit_date ?? ""}
            className={inputCls}
          />
        </Field>
      </div>

      <InvoicingSection initial={initial} />

      <Field label="Notatki">
        <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} className={inputCls} />
      </Field>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#282624] text-white py-3 font-medium active:opacity-80 disabled:opacity-50"
      >
        {pending ? "Zapisuję..." : submitLabel}
      </button>
    </form>
  );
}

const inputCls =
  "rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-3 text-base focus:outline-none focus:border-[#282624] w-full";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function InvoicingSection({ initial }: { initial?: Partial<Job> }) {
  const [invoiced, setInvoiced] = useState<boolean>(Boolean(initial?.invoiced));

  return (
    <fieldset className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex flex-col gap-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="invoiced"
          checked={invoiced}
          onChange={(e) => setInvoiced(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm font-medium text-zinc-700">Wystawiona faktura sprzedażowa</span>
      </label>
      {invoiced && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Numer faktury">
            <input
              name="invoice_number"
              placeholder="np. FV/2026/04/01"
              defaultValue={initial?.invoice_number ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Data wystawienia">
            <input
              type="date"
              name="invoice_date"
              defaultValue={initial?.invoice_date ?? ""}
              className={inputCls}
            />
          </Field>
        </div>
      )}
    </fieldset>
  );
}
