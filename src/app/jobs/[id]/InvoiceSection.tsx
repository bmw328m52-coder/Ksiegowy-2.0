"use client";

import { useActionState, useState } from "react";
import { Money } from "@/components/Money";
import { fmtPLN, fmtDate } from "@/lib/format";
import {
  markJobInvoicedAction,
  unmarkJobInvoicedAction,
} from "../actions";
import type { JobStatus } from "@/lib/dao/jobs.types";

export default function InvoiceSection({
  jobId,
  invoiced,
  invoiceNumber,
  invoiceDate,
  amountGross,
  status,
}: {
  jobId: string;
  invoiced: boolean;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  amountGross: number;
  status: JobStatus;
}) {
  const mark = markJobInvoicedAction.bind(null, jobId);
  const [state, action, pending] = useActionState(mark, {
    error: undefined as string | undefined,
  });

  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(today);

  if (status === "cancelled") return null;

  if (invoiced) {
    return (
      <section className="mt-4 rounded-xl border border-[#e8e4dd] bg-white p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-[#9c9081]">
            Faktura sprzedaży
          </p>
          <form action={unmarkJobInvoicedAction.bind(null, jobId)}>
            <button
              type="submit"
              className="text-[11px] text-[#9c9081] hover:text-[#3a3633] underline-offset-2 hover:underline"
            >
              Cofnij
            </button>
          </form>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#282624] truncate">
              FV {invoiceNumber}
            </p>
            <p className="text-[11px] text-[#9c9081]">
              {invoiceDate ? fmtDate(invoiceDate) : "brak daty"}
            </p>
          </div>
          {amountGross > 0 && (
            <Money className="text-sm font-semibold tabular-nums text-[#a06f3f]">
              {fmtPLN(amountGross)}
            </Money>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-[#e8e4dd] bg-white p-4 space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#9c9081]">
          Faktura sprzedaży
        </p>
        <p className="text-xs text-[#6f6457] mt-0.5">
          Wystawiłeś już FV w iFirma / Fakturowni? Zanotuj numer i datę tutaj —
          potrzebne do rozliczenia.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-[#9c9081]">
              Numer
            </span>
            <input
              name="invoice_number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="FV/05/2026"
              required
              className="h-[42px] px-3 rounded-lg border border-[#e8e4dd] bg-white text-sm focus:outline-2 focus:outline-[#a06f3f]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-[#9c9081]">
              Data
            </span>
            <input
              type="date"
              name="invoice_date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="h-[42px] px-3 rounded-lg border border-[#e8e4dd] bg-white text-sm focus:outline-2 focus:outline-[#a06f3f]"
            />
          </label>
        </div>
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending || !number.trim()}
          className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-[#a06f3f] hover:bg-[#7d5530] active:opacity-90 transition-colors disabled:opacity-50"
        >
          <span>{pending ? "Zapisuję…" : "Oznacz fakturę"}</span>
          <span aria-hidden>✓</span>
        </button>
      </form>
    </section>
  );
}
