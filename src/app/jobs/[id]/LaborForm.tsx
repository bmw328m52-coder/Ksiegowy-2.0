"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addManualEntryAction, deleteEntryAction } from "./timeActions";
import { setJobFuelAction } from "./laborActions";
import { WORK_PHASES, WORK_PHASE_LABELS, type WorkPhase } from "@/lib/dao/time_entries.types";
import { fmtDate, fmtDuration, fmtPLN } from "@/lib/format";

type Entry = { id: string; date: string; minutes: number; phase: WorkPhase; notes: string | null };

const inputCls =
  "rounded-lg border border-zinc-300 bg-white text-zinc-900 px-3 py-2.5 text-base focus:outline-none focus:border-accent w-full";

export default function LaborForm({
  jobId,
  defaultDate,
  totalMin,
  entries,
  fuel,
}: {
  jobId: string;
  defaultDate: string;
  totalMin: number;
  entries: Entry[];
  fuel: { id: string; amount: number } | null;
}) {
  const [state, addAction, adding] = useActionState(addManualEntryAction.bind(null, jobId), {});
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [fuelId, setFuelId] = useState<string | null>(fuel?.id ?? null);
  const [fuelMsg, setFuelMsg] = useState<{ ok?: string; error?: string }>({});
  const [error, setError] = useState<string | null>(null);

  // Po udanym dodaniu czyścimy pole godzin (data i faza zostają).
  useEffect(() => {
    if (!adding && !state.error) {
      const h = formRef.current?.elements.namedItem("hours") as HTMLInputElement | null;
      if (h) h.value = "";
    }
  }, [adding, state]);

  const remove = (id: string) => {
    if (!confirm("Usunąć ten wpis godzin?")) return;
    start(async () => {
      const r = await deleteEntryAction(jobId, id);
      setError(r.error ?? null);
    });
  };

  const saveFuel = (formData: FormData) =>
    start(async () => {
      setFuelMsg({});
      const r = await setJobFuelAction(jobId, fuelId, String(formData.get("fuel") ?? ""));
      if (r.error) return setFuelMsg({ error: r.error });
      setFuelId(r.id ?? null);
      setFuelMsg({ ok: "Zapisano" });
    });

  return (
    <section className="mt-4 rounded-xl border border-[#ededea] bg-white p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#8d8a85]">Godziny i dojazd</p>
        <p className="text-xl font-bold tabular-nums text-[#1f1d1b]">{totalMin > 0 ? fmtDuration(totalMin) : "0 h"}</p>
      </div>

      <form ref={formRef} action={addAction} className="space-y-2">
        <div className="grid grid-cols-[1fr_1.3fr] gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Godziny</span>
            <input name="hours" inputMode="decimal" placeholder="np. 6,5" required className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Dzień</span>
            <input name="date" type="date" defaultValue={defaultDate} required className={inputCls} />
          </label>
        </div>
        <div className="flex gap-2">
          <select name="phase" defaultValue="montaz" className={`${inputCls} flex-1`} aria-label="Rodzaj pracy">
            {WORK_PHASES.map((p) => (
              <option key={p} value={p}>
                {WORK_PHASE_LABELS[p]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg text-white text-[14px] font-semibold px-4 bg-[linear-gradient(160deg,#a06f3f,#7d5530)] disabled:opacity-50"
          >
            {adding ? "…" : "Dodaj"}
          </button>
        </div>
        {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      </form>

      {entries.length > 0 && (
        <ul className="divide-y divide-[#f0efec] border-y border-[#f0efec]">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate text-[#6f6c66]">
                {fmtDate(e.date)} · {WORK_PHASE_LABELS[e.phase]}
                {e.notes ? ` · ${e.notes}` : ""}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-medium tabular-nums">{fmtDuration(e.minutes)}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(e.id)}
                  className="text-zinc-400 hover:text-red-600 text-lg leading-none"
                  aria-label="Usuń wpis"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}

      <form action={saveFuel} className="flex items-end gap-2">
        <label className="flex flex-col gap-1 flex-1">
          <span className="text-xs font-medium text-zinc-600">Paliwo / dojazd (zł brutto)</span>
          <input
            name="fuel"
            inputMode="decimal"
            defaultValue={fuel ? String(fuel.amount).replace(".", ",") : ""}
            placeholder="np. 80"
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white border border-[#ededea] text-[14px] font-semibold px-4 py-2.5 active:bg-[#f6f6f5] disabled:opacity-50"
        >
          Zapisz
        </button>
      </form>
      {fuelMsg.ok && <p className="text-xs text-[#3a6b4d] -mt-2">{fuelMsg.ok}</p>}
      {fuelMsg.error && <p className="text-xs text-red-700 -mt-2">{fuelMsg.error}</p>}
      {fuel && !fuelMsg.ok && <p className="text-[11px] text-[#8d8a85] -mt-2">Obecnie: {fmtPLN(fuel.amount)} — wliczone w koszt zlecenia.</p>}
    </section>
  );
}
