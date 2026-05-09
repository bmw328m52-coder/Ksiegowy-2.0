"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  addManualEntryAction,
  deleteEntryAction,
  startTimerAction,
  stopActiveTimerAction,
} from "./timeActions";
import {
  WORK_PHASES,
  WORK_PHASE_LABELS,
  type TimeEntry,
  type WorkPhase,
} from "@/lib/dao/time_entries.types";
import { fmtDate, fmtMinutes, fmtHours } from "@/lib/format";

type Props = {
  jobId: string;
  entries: TimeEntry[];
  active: TimeEntry | null;
  phaseSums: Record<WorkPhase, number>;
};

const PHASE_ORDER: WorkPhase[] = [...WORK_PHASES];

export default function TimeTracker({ jobId, entries, active, phaseSums }: Props) {
  const isActiveHere = active && active.job_id === jobId;
  const isActiveElsewhere = active && active.job_id !== jobId;

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleStart = (phase: WorkPhase) => {
    setError(null);
    startTransition(async () => {
      const r = await startTimerAction(jobId, phase);
      if (r.error) setError(r.error);
    });
  };

  const handleStop = () => {
    setError(null);
    startTransition(async () => {
      const r = await stopActiveTimerAction(jobId);
      if (r.error) setError(r.error);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Usunąć ten wpis czasu?")) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteEntryAction(jobId, id);
      if (r.error) setError(r.error);
    });
  };

  const totalMin = PHASE_ORDER.reduce((s, p) => s + phaseSums[p], 0);

  return (
    <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-700">Czas pracy</h2>
        <span className="text-xs text-zinc-500">
          Suma: <strong className="tabular-nums">{fmtMinutes(totalMin)}</strong>
        </span>
      </div>

      {isActiveHere && active && <ActiveBanner entry={active} onStop={handleStop} pending={pending} />}

      {isActiveElsewhere && (
        <p className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-xs text-amber-800">
          Trwa licznik na innym zleceniu. Wybranie fazy tutaj zatrzyma poprzedni i zacznie nowy.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {PHASE_ORDER.map((phase) => {
          const isThis = isActiveHere && active?.phase === phase;
          return (
            <button
              key={phase}
              type="button"
              disabled={pending}
              onClick={() => (isThis ? handleStop() : handleStart(phase))}
              className={`rounded-lg border py-2.5 px-3 text-sm flex items-center justify-between active:opacity-70 disabled:opacity-50 ${
                isThis
                  ? "bg-emerald-600 text-white border-emerald-700"
                  : "bg-white text-zinc-800 border-zinc-300"
              }`}
            >
              <span className="font-medium">{WORK_PHASE_LABELS[phase]}</span>
              <span className="text-xs tabular-nums opacity-80">
                {phaseSums[phase] > 0 ? fmtMinutes(phaseSums[phase]) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <ManualEntryForm jobId={jobId} />

      {entries.length > 0 && <EntriesList entries={entries} onDelete={handleDelete} pending={pending} />}
    </section>
  );
}

function ActiveBanner({
  entry,
  onStop,
  pending,
}: {
  entry: TimeEntry;
  onStop: () => void;
  pending: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedMs = Math.max(0, now - new Date(entry.started_at).getTime());
  const totalSec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-300 px-3 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">
          ● Trwa: {WORK_PHASE_LABELS[entry.phase]}
        </p>
        <p className="text-2xl font-bold tabular-nums text-emerald-900">
          {pad(h)}:{pad(m)}:{pad(s)}
        </p>
      </div>
      <button
        type="button"
        onClick={onStop}
        disabled={pending}
        className="rounded-lg bg-red-600 text-white py-2 px-4 text-sm font-medium active:opacity-80 disabled:opacity-50"
      >
        Stop
      </button>
    </div>
  );
}

function ManualEntryForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const action = addManualEntryAction.bind(null, jobId);
  const [state, formAction, pending] = useActionState(action, { error: undefined } as {
    error?: string;
  });
  const today = new Date().toISOString().slice(0, 10);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-zinc-600 underline-offset-2 hover:underline"
      >
        + Wpisz czas ręcznie
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 border-t border-zinc-100 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="text-zinc-600">Faza</span>
          <select
            name="phase"
            defaultValue="produkcja"
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            required
          >
            {PHASE_ORDER.map((p) => (
              <option key={p} value={p}>
                {WORK_PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="text-zinc-600">Data</span>
          <input
            type="date"
            name="date"
            defaultValue={today}
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            required
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="text-zinc-600">Godziny</span>
          <input
            type="number"
            name="hours"
            min="0"
            step="1"
            placeholder="0"
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            inputMode="numeric"
          />
        </label>
        <label className="text-xs">
          <span className="text-zinc-600">Minuty</span>
          <input
            type="number"
            name="minutes"
            min="0"
            max="59"
            step="1"
            placeholder="0"
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            inputMode="numeric"
          />
        </label>
      </div>
      <input
        type="text"
        name="notes"
        placeholder="Notatka (opcjonalnie)"
        className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
      />
      {state.error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-md bg-[#282624] text-white py-2 text-sm font-medium active:opacity-80 disabled:opacity-50"
        >
          {pending ? "Zapisuję…" : "Dodaj wpis"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

function EntriesList({
  entries,
  onDelete,
  pending,
}: {
  entries: TimeEntry[];
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div className="border-t border-zinc-100 pt-3">
      <p className="text-xs text-zinc-500 mb-2">Ostatnie wpisy</p>
      <ul className="space-y-1.5">
        {entries.slice(0, 10).map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2 py-1.5 text-xs"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium">{WORK_PHASE_LABELS[e.phase]}</span>
              <span className="text-zinc-500"> · {fmtDate(e.started_at)}</span>
              {e.source === "manual" && (
                <span className="ml-1 text-[10px] text-amber-700">[ręcznie]</span>
              )}
              {e.notes && <p className="text-zinc-500 truncate">{e.notes}</p>}
            </div>
            <span className="tabular-nums">{fmtHours(e.duration_minutes ?? 0)}</span>
            <button
              type="button"
              onClick={() => onDelete(e.id)}
              disabled={pending}
              className="text-red-600 hover:underline disabled:opacity-50"
              aria-label="Usuń"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {entries.length > 10 && (
        <p className="text-[11px] text-zinc-500 mt-2">
          Pokazuję 10 z {entries.length} wpisów.
        </p>
      )}
    </div>
  );
}
