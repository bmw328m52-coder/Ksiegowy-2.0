"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  addManualEntryAction,
  deleteEntryAction,
  startTimerAction,
  stopActiveTimerAction,
  updateEntryAction,
} from "./timeActions";
import {
  WORK_PHASES,
  WORK_PHASE_LABELS,
  type TimeEntry,
  type WorkPhase,
} from "@/lib/dao/time_entries.types";
import { fmtDate, fmtDuration } from "@/lib/format";

type Props = {
  jobId: string;
  entries: TimeEntry[];
  active: TimeEntry | null;
  phaseSums: Record<WorkPhase, number>;
};

const PHASE_ORDER: WorkPhase[] = [...WORK_PHASES];

const PHASE_COLORS: Record<WorkPhase, string> = {
  pomiar: "#3b82f6",
  projekt: "#8b5cf6",
  produkcja: "#10b981",
  montaz: "#f59e0b",
  inne: "#6b7280",
};

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

  const handleUpdate = (
    entryId: string,
    input: { phase: WorkPhase; hours: number; minutes: number; notes: string | null }
  ) =>
    new Promise<{ error?: string }>((resolve) => {
      setError(null);
      startTransition(async () => {
        const r = await updateEntryAction(jobId, entryId, input);
        if (r.error) setError(r.error);
        resolve(r);
      });
    });

  const totalMin = PHASE_ORDER.reduce((s, p) => s + phaseSums[p], 0);

  return (
    <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
      <h2 className="text-sm font-semibold text-zinc-700">Czas pracy</h2>

      <SummaryCard totalMin={totalMin} phaseSums={phaseSums} />

      {isActiveHere && active && <ActiveBanner entry={active} onStop={handleStop} pending={pending} />}

      {isActiveElsewhere && (
        <p className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-xs text-amber-800">
          Trwa licznik na innym zleceniu. Wybranie fazy tutaj zatrzyma poprzedni i zacznie nowy.
        </p>
      )}

      <div>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 mb-2">
          Start / Stop fazy
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PHASE_ORDER.map((phase) => {
            const isThis = isActiveHere && active?.phase === phase;
            return (
              <button
                key={phase}
                type="button"
                disabled={pending}
                onClick={() => (isThis ? handleStop() : handleStart(phase))}
                className={`rounded-lg border py-2.5 px-3 text-sm flex items-center justify-between gap-2 active:opacity-70 disabled:opacity-50 ${
                  isThis
                    ? "bg-emerald-600 text-white border-emerald-700"
                    : "bg-white text-zinc-800 border-zinc-300"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{
                      background: isThis ? "#fff" : PHASE_COLORS[phase],
                    }}
                  />
                  <span className="font-medium truncate">
                    {WORK_PHASE_LABELS[phase]}
                  </span>
                </span>
                <span className="text-[11px] tabular-nums opacity-80 shrink-0">
                  {isThis ? "Stop" : phaseSums[phase] > 0 ? fmtDuration(phaseSums[phase]) : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <ManualEntryForm jobId={jobId} />

      {entries.length > 0 && (
        <EntriesList
          entries={entries}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          pending={pending}
        />
      )}
    </section>
  );
}

function SummaryCard({
  totalMin,
  phaseSums,
}: {
  totalMin: number;
  phaseSums: Record<WorkPhase, number>;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500">
          Łącznie
        </p>
        <p className="text-2xl font-bold tabular-nums text-zinc-900">
          {fmtDuration(totalMin)}
        </p>
      </div>

      {totalMin > 0 && (
        <>
          {/* Stacked bar */}
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-zinc-100">
            {PHASE_ORDER.map((p) => {
              const v = phaseSums[p];
              if (v <= 0) return null;
              const pct = (v / totalMin) * 100;
              return (
                <div
                  key={p}
                  style={{ width: `${pct}%`, background: PHASE_COLORS[p] }}
                  title={`${WORK_PHASE_LABELS[p]} — ${fmtDuration(v)}`}
                />
              );
            })}
          </div>

          {/* Per-phase rows */}
          <ul className="mt-3 space-y-1.5">
            {PHASE_ORDER.filter((p) => phaseSums[p] > 0).map((p) => {
              const v = phaseSums[p];
              const pct = (v / totalMin) * 100;
              return (
                <li
                  key={p}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: PHASE_COLORS[p] }}
                  />
                  <span className="font-medium text-zinc-800 w-20 shrink-0">
                    {WORK_PHASE_LABELS[p]}
                  </span>
                  <span className="tabular-nums text-zinc-900 font-semibold flex-1">
                    {fmtDuration(v)}
                  </span>
                  <span className="tabular-nums text-zinc-500 text-[11px] w-12 text-right">
                    {pct.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {totalMin === 0 && (
        <p className="text-xs text-zinc-400 italic">
          Brak zarejestrowanego czasu. Wystartuj licznik lub dodaj wpis ręcznie.
        </p>
      )}
    </div>
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
          className="flex-1 rounded-md bg-accent text-white py-2 text-sm font-medium active:opacity-80 disabled:opacity-50"
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
  onUpdate,
  pending,
}: {
  entries: TimeEntry[];
  onDelete: (id: string) => void;
  onUpdate: (
    entryId: string,
    input: { phase: WorkPhase; hours: number; minutes: number; notes: string | null }
  ) => Promise<{ error?: string }>;
  pending: boolean;
}) {
  return (
    <div className="border-t border-zinc-100 pt-3">
      <p className="text-xs text-zinc-500 mb-2">Ostatnie wpisy</p>
      <ul className="space-y-1.5">
        {entries.slice(0, 10).map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            onDelete={onDelete}
            onUpdate={onUpdate}
            pending={pending}
          />
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

function EntryRow({
  entry,
  onDelete,
  onUpdate,
  pending,
}: {
  entry: TimeEntry;
  onDelete: (id: string) => void;
  onUpdate: (
    entryId: string,
    input: { phase: WorkPhase; hours: number; minutes: number; notes: string | null }
  ) => Promise<{ error?: string }>;
  pending: boolean;
}) {
  const total = entry.duration_minutes ?? 0;
  const initH = Math.floor(total / 60);
  const initM = total % 60;

  const [editing, setEditing] = useState(false);
  const [phase, setPhase] = useState<WorkPhase>(entry.phase);
  const [hours, setHours] = useState<string>(String(initH));
  const [minutes, setMinutes] = useState<string>(String(initM));
  const [notes, setNotes] = useState<string>(entry.notes ?? "");
  const [rowErr, setRowErr] = useState<string | null>(null);

  const open = () => {
    setPhase(entry.phase);
    setHours(String(initH));
    setMinutes(String(initM));
    setNotes(entry.notes ?? "");
    setRowErr(null);
    setEditing(true);
  };

  const save = async () => {
    const h = Number(hours.replace(",", ".")) || 0;
    const m = Number(minutes) || 0;
    setRowErr(null);
    const r = await onUpdate(entry.id, {
      phase,
      hours: h,
      minutes: m,
      notes: notes.trim() === "" ? null : notes.trim(),
    });
    if (r.error) {
      setRowErr(r.error);
      return;
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="rounded-md border border-zinc-300 bg-white p-2 text-xs space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          <label className="col-span-3">
            <span className="text-zinc-600">Faza</span>
            <select
              value={phase}
              onChange={(ev) => setPhase(ev.target.value as WorkPhase)}
              className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              {PHASE_ORDER.map((p) => (
                <option key={p} value={p}>
                  {WORK_PHASE_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-zinc-600">Godziny</span>
            <input
              type="number"
              min="0"
              step="1"
              value={hours}
              onChange={(ev) => setHours(ev.target.value)}
              inputMode="numeric"
              className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label>
            <span className="text-zinc-600">Minuty</span>
            <input
              type="number"
              min="0"
              max="59"
              step="1"
              value={minutes}
              onChange={(ev) => setMinutes(ev.target.value)}
              inputMode="numeric"
              className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="text-zinc-500 self-end pb-1 tabular-nums">
            = {fmtDuration((Number(hours) || 0) * 60 + (Number(minutes) || 0))}
          </div>
        </div>
        <input
          type="text"
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
          placeholder="Notatka (opcjonalnie)"
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <p className="text-[11px] text-zinc-500">
          Start: {fmtDate(entry.started_at)} · Korekta zmienia długość, początek pozostaje bez zmian.
        </p>
        {rowErr && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
            {rowErr}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex-1 rounded-md bg-accent text-white py-1.5 text-sm font-medium active:opacity-80 disabled:opacity-50"
          >
            {pending ? "Zapisuję…" : "Zapisz"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={pending}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            Anuluj
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2 py-1.5 text-xs">
      <div className="min-w-0 flex-1">
        <span className="font-medium">{WORK_PHASE_LABELS[entry.phase]}</span>
        <span className="text-zinc-500"> · {fmtDate(entry.started_at)}</span>
        {entry.source === "manual" && (
          <span className="ml-1 text-[10px] text-amber-700">[ręcznie]</span>
        )}
        {entry.notes && <p className="text-zinc-500 truncate">{entry.notes}</p>}
      </div>
      <span className="tabular-nums">{fmtDuration(entry.duration_minutes ?? 0)}</span>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className="text-zinc-600 hover:underline disabled:opacity-50"
        aria-label="Edytuj"
        title="Korekta czasu"
      >
        ✎
      </button>
      <button
        type="button"
        onClick={() => onDelete(entry.id)}
        disabled={pending}
        className="text-red-600 hover:underline disabled:opacity-50"
        aria-label="Usuń"
      >
        ✕
      </button>
    </li>
  );
}
