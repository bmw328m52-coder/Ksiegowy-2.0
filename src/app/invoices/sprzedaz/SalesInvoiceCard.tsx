"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtDate, fmtPLN } from "@/lib/format";
import { createJobFromSalesInvoiceAction, linkSalesInvoiceAction } from "./actions";

export type SalesRow = {
  id: string;
  number: string | null;
  type: string | null;
  date: string;
  buyer: string;
  net: number;
  vat: number;
  gross: number;
  paid: boolean;
  summary: string;
  jobId: string | null;
  jobLabel: string | null;
  options: { id: string; label: string; suggested: boolean }[];
};

const TYPE_LABELS: Record<string, string> = { Zal: "zaliczkowa", Kor: "korekta", Roz: "rozliczeniowa", KorZal: "korekta zaliczki" };

export default function SalesInvoiceCard({ row }: { row: SalesRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState<string | null>(row.jobId);
  const [jobLabel, setJobLabel] = useState<string | null>(row.jobLabel);
  const [choice, setChoice] = useState<string>(row.options.find((o) => o.suggested)?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const link = (id: string | null) =>
    start(async () => {
      setError(null);
      const r = await linkSalesInvoiceAction(row.id, id);
      if (r.error) return setError(r.error);
      setJobId(id);
      setJobLabel(id ? (row.options.find((o) => o.id === id)?.label ?? null) : null);
      router.refresh();
    });

  const createJob = () =>
    start(async () => {
      setError(null);
      const r = await createJobFromSalesInvoiceAction(row.id);
      if (r.error || !r.jobId) return setError(r.error ?? "Nie udało się utworzyć zlecenia.");
      setJobId(r.jobId);
      setJobLabel(`${row.buyer} · nowe zlecenie`);
      router.refresh();
    });

  const suggested = row.options.filter((o) => o.suggested);
  const others = row.options.filter((o) => !o.suggested);

  return (
    <div className={`rounded-xl border bg-white p-3 ${jobId ? "border-zinc-200" : "border-[#e2c79c]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.buyer}</p>
          <p className="text-[11px] text-zinc-500 truncate">
            {row.number ?? "bez numeru"} · {fmtDate(row.date)}
            {row.type && TYPE_LABELS[row.type] ? ` · ${TYPE_LABELS[row.type]}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums">{fmtPLN(row.gross)}</p>
          <p className="text-[10px] text-zinc-500 tabular-nums">
            netto {fmtPLN(row.net)} · VAT {fmtPLN(row.vat)}
          </p>
        </div>
      </div>
      {row.summary && <p className="text-xs text-zinc-600 truncate mt-1">{row.summary}</p>}

      <div className="mt-2.5 pt-2.5 border-t border-[#f0efec]">
        {jobId ? (
          <div className="flex items-center justify-between gap-2">
            <Link href={`/jobs/${jobId}`} className="text-xs font-medium text-[#a06f3f] truncate">
              ✓ {jobLabel ?? "Przypięte do zlecenia"}
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() => link(null)}
              className="text-[11px] text-zinc-500 underline shrink-0"
            >
              Odepnij
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <select
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
              >
                <option value="">Wybierz zlecenie…</option>
                {suggested.length > 0 && (
                  <optgroup label="Pasujące">
                    {suggested.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Wszystkie">
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <button
                type="button"
                disabled={pending || !choice}
                onClick={() => link(choice)}
                className="rounded-lg text-white text-[13px] font-semibold px-3 bg-[linear-gradient(160deg,#a06f3f,#7d5530)] disabled:opacity-50"
              >
                Przypnij
              </button>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={createJob}
              className="rounded-lg bg-white border border-[#ededea] text-[13px] font-semibold py-2 active:bg-[#f6f6f5] disabled:opacity-50"
            >
              {pending ? "Zapisuję…" : "Utwórz zlecenie z tej faktury"}
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-700 mt-1.5">{error}</p>}
      </div>
    </div>
  );
}
