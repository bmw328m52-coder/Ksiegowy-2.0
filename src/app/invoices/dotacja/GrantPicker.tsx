"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtDate, fmtPLN } from "@/lib/format";
import { setGrantInvoicesAction } from "../actions";

export type GrantRow = {
  id: string;
  supplier: string;
  number: string | null;
  date: string | null;
  net: number;
  vat: number;
  gross: number;
  summary: string;
  suggested: boolean;
  checked: boolean;
};

export default function GrantPicker({ rows }: { rows: GrantRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.filter((r) => r.checked).map((r) => r.id)));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  const totals = useMemo(
    () =>
      rows
        .filter((r) => selected.has(r.id))
        .reduce((a, r) => ({ n: a.n + r.net, v: a.v + r.vat, g: a.g + r.gross, c: a.c + 1 }), { n: 0, v: 0, g: 0, c: 0 }),
    [rows, selected]
  );

  const toggle = (id: string) => {
    setMsg({});
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = () =>
    startTransition(async () => {
      const r = await setGrantInvoicesAction([...selected]);
      setMsg(r.error ? { error: r.error } : { ok: "Zapisano." });
      if (!r.error) router.refresh();
    });

  const suggestedCount = rows.filter((r) => r.suggested).length;

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 py-2 bg-[var(--background)]">
        <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-[#6f6c66]">Zaznaczone: {totals.c} · razem brutto</span>
            <span className="text-lg font-semibold text-[#1f1d1b] tabular-nums">{fmtPLN(totals.g)}</span>
          </div>
          <div className="flex justify-between text-[13px] text-[#6f6c66] tabular-nums">
            <span>netto {fmtPLN(totals.n)}</span>
            <span>VAT {fmtPLN(totals.v)}</span>
          </div>
          <div className="flex gap-2 mt-2.5">
            {suggestedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMsg({});
                  setSelected((prev) => new Set([...prev, ...rows.filter((r) => r.suggested).map((r) => r.id)]));
                }}
                className="flex-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[13px] font-semibold min-h-[44px] active:bg-[var(--surface-2)]"
              >
                Zaznacz sprzęt ({suggestedCount})
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-lg text-[var(--background)] text-[13px] font-semibold min-h-[44px] bg-[var(--accent)] disabled:opacity-60"
            >
              {pending ? "Zapisuję…" : "Zapisz"}
            </button>
          </div>
          {msg.ok && <p role="status" className="text-[13px] text-[#3a6b4d] mt-2">{msg.ok}</p>}
          {msg.error && <p role="alert" className="text-[13px] text-red-700 mt-2">{msg.error}</p>}
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const on = selected.has(r.id);
          return (
            <li key={r.id}>
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
                  on ? "border-[#a06f3f] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(r.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium break-words">{r.supplier}</p>
                    <span className="text-sm font-medium tabular-nums shrink-0">{fmtPLN(r.gross)} <span className="text-[12px] font-normal text-zinc-500">brutto</span></span>
                  </div>
                  <p className="text-[13px] text-zinc-500 break-words">
                    {r.number ?? "bez numeru"} · {fmtDate(r.date)}
                    {r.suggested && !on ? " · wygląda na sprzęt" : ""}
                  </p>
                  {r.summary && <p className="text-[13px] text-zinc-600 break-words mt-0.5">{r.summary}</p>}
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );
}
