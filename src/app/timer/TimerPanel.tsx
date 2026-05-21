"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  startTimerAction,
  stopActiveTimerAction,
  deleteEntryAction,
} from "@/app/jobs/[id]/timeActions";
import {
  WORK_PHASES,
  WORK_PHASE_LABELS,
  type TimeEntry,
  type WorkPhase,
} from "@/lib/dao/time_entries.types";
import type { Job } from "@/lib/dao/jobs";
import { fmtDate, fmtDuration } from "@/lib/format";

type JobWithClient = Job & { client_name: string };

type RecentItem = {
  entry: TimeEntry;
  job: JobWithClient | null;
};

const PHASE_ORDER: WorkPhase[] = [...WORK_PHASES];

export default function TimerPanel({
  jobs,
  active,
  activeJob,
  recent,
}: {
  jobs: JobWithClient[];
  active: TimeEntry | null;
  activeJob: JobWithClient | null;
  recent: RecentItem[];
}) {
  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of jobs) map.set(j.client_id, j.client_name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "pl")
    );
  }, [jobs]);

  const [clientId, setClientId] = useState<string>(activeJob?.client_id ?? "");
  const [jobId, setJobId] = useState<string>(activeJob?.id ?? "");

  const clientJobs = useMemo(
    () => jobs.filter((j) => j.client_id === clientId),
    [jobs, clientId]
  );

  useEffect(() => {
    if (jobId && !clientJobs.some((j) => j.id === jobId)) setJobId("");
  }, [clientJobs, jobId]);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleStart = (phase: WorkPhase) => {
    if (!jobId) {
      setError("Wybierz klienta i pomiar.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await startTimerAction(jobId, phase);
      if (r.error) setError(r.error);
    });
  };

  const handleStop = () => {
    if (!active) return;
    setError(null);
    startTransition(async () => {
      const r = await stopActiveTimerAction(active.job_id);
      if (r.error) setError(r.error);
    });
  };

  const handleDelete = (entry: TimeEntry) => {
    if (!confirm("Usunąć ten wpis czasu?")) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteEntryAction(entry.job_id, entry.id);
      if (r.error) setError(r.error);
    });
  };

  const selectCls =
    "w-full rounded-md border border-zinc-300 bg-white text-zinc-900 px-3 py-2 text-sm focus:outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-4">
      {active && (
        <ActiveBanner
          entry={active}
          jobLabel={
            activeJob
              ? `${activeJob.client_name} — ${activeJob.title}`
              : "(usunięty pomiar)"
          }
          onStop={handleStop}
          pending={pending}
        />
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-700">Wybierz pomiar</h2>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">Klient</span>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setJobId("");
            }}
            className={selectCls}
          >
            <option value="">— wybierz klienta —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">Pomiar</span>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={!clientId}
            className={selectCls}
          >
            <option value="">
              {clientId ? "— wybierz pomiar —" : "(najpierw klient)"}
            </option>
            {clientJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="text-xs text-zinc-500 mb-2">Faza pracy</p>
          <div className="grid grid-cols-2 gap-2">
            {PHASE_ORDER.map((phase) => {
              const isThis = active && jobId === active.job_id && active.phase === phase;
              return (
                <button
                  key={phase}
                  type="button"
                  disabled={pending || !jobId}
                  onClick={() => (isThis ? handleStop() : handleStart(phase))}
                  className={`rounded-lg border py-2.5 px-3 text-sm flex items-center justify-center font-medium active:opacity-70 disabled:opacity-50 ${
                    isThis
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : "bg-white text-zinc-800 border-zinc-300"
                  }`}
                >
                  {WORK_PHASE_LABELS[phase]}
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
      </section>

      {recent.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-700 mb-2">Ostatnie wpisy</h2>
          <ul className="space-y-1.5">
            {recent.map(({ entry, job }) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {job ? `${job.client_name} — ${job.title}` : "(usunięty pomiar)"}
                  </p>
                  <p className="text-zinc-500 truncate">
                    {WORK_PHASE_LABELS[entry.phase]} · {fmtDate(entry.started_at)}
                    {entry.source === "manual" && (
                      <span className="ml-1 text-amber-700">[ręcznie]</span>
                    )}
                  </p>
                </div>
                <span className="tabular-nums shrink-0">
                  {fmtDuration(entry.duration_minutes ?? 0)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(entry)}
                  disabled={pending}
                  className="text-red-600 hover:underline disabled:opacity-50 shrink-0"
                  aria-label="Usuń"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ActiveBanner({
  entry,
  jobLabel,
  onStop,
  pending,
}: {
  entry: TimeEntry;
  jobLabel: string;
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
    <div className="rounded-xl bg-emerald-50 border border-emerald-300 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">
          ● Trwa: {WORK_PHASE_LABELS[entry.phase]}
        </p>
        <p className="text-2xl font-bold tabular-nums text-emerald-900">
          {pad(h)}:{pad(m)}:{pad(s)}
        </p>
        <p className="text-xs text-emerald-800 truncate mt-0.5">{jobLabel}</p>
      </div>
      <button
        type="button"
        onClick={onStop}
        disabled={pending}
        className="rounded-lg bg-red-600 text-white py-2 px-4 text-sm font-medium active:opacity-80 disabled:opacity-50 shrink-0"
      >
        Stop
      </button>
    </div>
  );
}
