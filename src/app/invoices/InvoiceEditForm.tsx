"use client";

import { useActionState } from "react";
import type { Invoice } from "@/lib/dao/invoices.types";
import { updateInvoiceAction } from "./actions";

type Action = (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;

export default function InvoiceEditForm({ invoice }: { invoice: Invoice }) {
  const action: Action = updateInvoiceAction.bind(null, invoice.id);
  const [state, formAction, pending] = useActionState(action, { error: undefined });

  const vatPct =
    invoice.vat_rate !== null && invoice.vat_rate !== undefined
      ? Math.round(Number(invoice.vat_rate) * 100).toString()
      : "";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Sprzedawca">
        <input name="supplier_name" defaultValue={invoice.supplier_name ?? ""} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="NIP sprzedawcy">
          <input name="supplier_nip" inputMode="numeric" defaultValue={invoice.supplier_nip ?? ""} className={inputCls} />
        </Field>
        <Field label="Numer faktury">
          <input name="invoice_number" defaultValue={invoice.invoice_number ?? ""} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data wystawienia">
          <input type="date" name="issue_date" defaultValue={invoice.issue_date ?? ""} className={inputCls} />
        </Field>
        <Field label="Termin płatności">
          <input type="date" name="payment_due" defaultValue={invoice.payment_due ?? ""} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Netto">
          <input name="amount_net" inputMode="decimal" defaultValue={invoice.amount_net ?? ""} className={inputCls} />
        </Field>
        <Field label="VAT (zł)">
          <input name="amount_vat" inputMode="decimal" defaultValue={invoice.amount_vat ?? ""} className={inputCls} />
        </Field>
        <Field label="Brutto">
          <input name="amount_gross" inputMode="decimal" defaultValue={invoice.amount_gross ?? ""} className={inputCls} />
        </Field>
      </div>
      <Field label="Stawka VAT (%)">
        <select name="vat_rate" defaultValue={vatPct} className={inputCls}>
          <option value="">—</option>
          <option value="23">23%</option>
          <option value="8">8%</option>
          <option value="5">5%</option>
          <option value="0">0% / zw</option>
        </select>
      </Field>
      <Field label="Notatki">
        <textarea name="notes" rows={2} defaultValue={invoice.notes ?? ""} className={inputCls} />
      </Field>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-white py-2.5 font-medium active:opacity-80 disabled:opacity-50"
      >
        {pending ? "Zapisuję..." : "Zapisz dane faktury"}
      </button>
    </form>
  );
}

const inputCls =
  "rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2.5 text-sm focus:outline-none focus:border-accent w-full";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  );
}
