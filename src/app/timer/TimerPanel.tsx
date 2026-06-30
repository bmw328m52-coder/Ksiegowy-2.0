"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  startTimerAction,
  stopActiveTimerAction,
  deleteEntryAction,
  addManualEntryAction,
} from "@/app/jobs/[id]/timeActions";
import {
  WORK_PHASES,
  WORK_PHASE_LABELS,
  type TimeEntry,
  type WorkPhase,
} from "@/lib/dao/time_entries.types";
import type { Job } from "@/lib/dao/jobs";
import { fmtDate, fmtDuration } from "@/lib/format";

// Przychód netto zlecenia (spójnie z panelem Rentowność): netto gdy VAT-owiec, w innym razie brutto.
function revenueNet(job: Pick<Job, "amount_gross" | "vat_rate">, isVatPayer: boolean): number {
  const gross = Number(job.amount_gross) || 0;
  const rate = Number(job.vat_rate) || 0;
  return isVatPayer && rate > 0 ? gross / (1 + rate) : gross;
}

// Stawka zł/h = przychód ÷ przepracowane godziny. null gdy brak wartości lub czasu.
function hourlyRate(revenue: number, minutes: number): number | null {
  if (revenue <= 0 || minutes <= 0) return null;
  return revenue / (minutes / 60);
}

function fmtRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate).toLocaleString("pl-PL")} zł/h`;
}

// Kolor stawki względem docelowej: zielony ≥ cel, bursztynowy ≥ 80% celu, czerwony niżej.
function rateTone(rate: number | null, target: number): string {
  if (rate === null) return "text-zinc-400";
  if (target <= 0) return "text-zinc-700";
  if (rate >= target) return "text-emerald-600";
  if (rate >= target * 0.8) return "text-amber-600";
  return "text-red-600";
}

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
  minutesByJob,
  isVatPayer,
  targetRate,
}: {
  jobs: JobWithClient[];
  active: TimeEntry | null;
  activeJob: JobWithClient | null;
  recent: RecentItem[];
  minutesByJob: Record<string, number>;
  isVatPayer: boolean;
  targetRate: number;
}) {
  // Podsumowanie: łączny czas + przychód per klient (z rozbiciem na zlecenia) → stawka zł/h.
  const summary = useMemo(() => {
    const byClient = new Map<
      string,
      {
        name: string;
        total: number;
        revenue: number;
        jobs: { id: string; title: string; minutes: number; revenue: number }[];
      }
    >();
    for (const j of jobs) {
      const minutes = minutesByJob[j.id] ?? 0;
      if (minutes <= 0) continue;
      const revenue = revenueNet(j, isVatPayer);
      const cur =
        byClient.get(j.client_id) ?? { name: j.client_name, total: 0, revenue: 0, jobs: [] };
      cur.total += minutes;
      cur.revenue += revenue;
      cur.jobs.push({ id: j.id, title: j.title, minutes, revenue });
      byClient.set(j.client_id, cur);
    }
    const clients = Array.from(byClient.values()).sort((a, b) => b.total - a.total);
    for (const c of clients) c.jobs.sort((a, b) => b.minutes - a.minutes);
    const grandTotal = clients.reduce((s, c) => s + c.total, 0);
    const grandRevenue = clients.reduce((s, c) => s + c.revenue, 0);
    return { clients, grandTotal, grandRevenue };
  }, [jobs, minutesByJob, isVatPayer]);
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
          revenue={activeJob ? revenueNet(activeJob, isVatPayer) : 0}
          priorMinutes={minutesByJob[active.job_id] ?? 0}
          targetRate={targetRate}
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

        <EmergencyManualEntry jobId={jobId} />
      </section>

      {summary.clients.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-sm font-semibold text-zinc-700">Łączny czas pracy</h2>
            <div className="text-right shrink-0">
              <span className="block text-sm font-bold tabular-nums text-zinc-900">
                {fmtDuration(summary.grandTotal)}
              </span>
              <span
                className={`block text-xs font-semibold tabular-nums ${rateTone(
                  hourlyRate(summary.grandRevenue, summary.grandTotal),
                  targetRate
                )}`}
              >
                {fmtRate(hourlyRate(summary.grandRevenue, summary.grandTotal))}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 mb-3">
            Stawka = wartość zlecenia ÷ godziny. Cel: {Math.round(targetRate)} zł/h.
          </p>
          <ul className="flex flex-col gap-2.5">
            {summary.clients.map((c) => {
              const cRate = hourlyRate(c.revenue, c.total);
              return (
                <li key={c.name} className="rounded-lg bg-zinc-50 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-sm text-zinc-900 truncate">{c.name}</span>
                    <span className="flex items-baseline gap-2 shrink-0">
                      <span className="text-sm font-semibold tabular-nums text-accent">
                        {fmtDuration(c.total)}
                      </span>
                      <span className={`text-xs font-semibold tabular-nums ${rateTone(cRate, targetRate)}`}>
                        {fmtRate(cRate)}
                      </span>
                    </span>
                  </div>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {c.jobs.map((j) => {
                      const jRate = hourlyRate(j.revenue, j.minutes);
                      return (
                        <li
                          key={j.id}
                          className="flex items-baseline justify-between gap-2 text-xs text-zinc-600"
                        >
                          <span className="truncate">{j.title}</span>
                          <span className="flex items-baseline gap-2 shrink-0">
                            <span className="tabular-nums">{fmtDuration(j.minutes)}</span>
                            <span className={`tabular-nums font-medium ${rateTone(jRate, targetRate)}`}>
                              {fmtRate(jRate)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
  revenue,
  priorMinutes,
  targetRate,
  onStop,
  pending,
}: {
  entry: TimeEntry;
  jobLabel: string;
  revenue: number;
  priorMinutes: number;
  targetRate: number;
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

  // Stawka na żywo: przychód ÷ (czas już zapisany na tym zleceniu + bieżący bieg). Tyka w dół.
  const liveMinutes = priorMinutes + elapsedMs / 60000;
  const liveRate = hourlyRate(revenue, liveMinutes);

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
        {liveRate !== null && (
          <p className="mt-1 text-sm font-bold tabular-nums">
            <span className={rateTone(liveRate, targetRate)}>≈ {fmtRate(liveRate)}</span>
            <span className="ml-1.5 text-[11px] font-normal text-emerald-700/70">
              cel {Math.round(targetRate)} zł/h
            </span>
          </p>
        )}
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

// Awaryjny wpis godzin — gdy zapomnisz włączyć licznik. Używa wybranego wyżej klienta/pomiaru.
function EmergencyManualEntry({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [phase, setPhase] = useState<WorkPhase>("produkcja");
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setPhase("produkcja");
    setDate(today);
    setHours("");
    setMinutes("");
    setNotes("");
    setError(null);
  };

  const submit = () => {
    if (!jobId) {
      setError("Najpierw wybierz klienta i pomiar powyżej.");
      return;
    }
    const fd = new FormData();
    fd.set("phase", phase);
    fd.set("date", date);
    fd.set("hours", hours);
    fd.set("minutes", minutes);
    fd.set("notes", notes);
    setError(null);
    startTransition(async () => {
      const r = await addManualEntryAction(jobId, {}, fd);
      if (r.error) {
        setError(r.error);
        return;
      }
      reset();
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-zinc-600 underline-offset-2 hover:underline self-start"
      >
        + Wpisz czas ręcznie (zapomniałeś włączyć?)
      </button>
    );
  }

  const inputCls =
    "mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:border-accent";

  return (
    <div className="space-y-2 border-t border-zinc-100 pt-3">
      <p className="text-xs text-zinc-600">
        Awaryjny wpis — dopisze czas do wybranego wyżej pomiaru.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="text-zinc-600">Faza</span>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as WorkPhase)}
            className={inputCls}
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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="text-zinc-600">Godziny</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="text-xs">
          <span className="text-zinc-600">Minuty</span>
          <input
            type="number"
            min="0"
            max="59"
            step="1"
            inputMode="numeric"
            placeholder="0"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
      <input
        type="text"
        placeholder="Notatka (opcjonalnie)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
      />
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex-1 rounded-md bg-accent text-white py-2 text-sm font-medium active:opacity-80 disabled:opacity-50"
        >
          {pending ? "Zapisuję…" : "Dodaj wpis"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
