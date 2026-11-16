import Link from "next/link";
import type { ReactNode } from "react";
import type { JobStatus } from "@/lib/dao/jobs.types";
import { PHASES, phaseOfStatus, phaseIndex, isJobClosed } from "@/lib/jobPhases";
import { jobStatusLabel } from "@/lib/jobStatusView";
import { fmtDate, fmtPLN } from "@/lib/format";
import { Money } from "@/components/Money";

export type JobView = (typeof PHASES)[number]["key"] | "finanse";

export function parseJobView(raw: string | undefined, fallback: JobView): JobView {
  if (raw === "finanse") return "finanse";
  return PHASES.find((p) => p.key === raw)?.key ?? fallback;
}

/**
 * Nagłówek zlecenia: ciemny panel z klientem, tytułem, kwotą i poziomym stepperem.
 * Każdy krok to zakładka (?faza=) — strona pokazuje wyłącznie treść wybranego kroku.
 */
export default function JobHero({
  jobId,
  clientId,
  clientName,
  title,
  status,
  amountGross,
  dueDate,
  view,
  menu,
}: {
  jobId: string;
  clientId: string;
  clientName: string;
  title: string;
  status: JobStatus;
  amountGross: number;
  dueDate: string | null;
  view: JobView;
  menu: ReactNode;
}) {
  const phase = phaseOfStatus(status);
  const closed = isJobClosed(status);
  const cur = phase ? phaseIndex(phase) : -1;

  return (
    <header className="lj-hero">
      <div className="lj-hero-top">
        <Link href={`/clients/${clientId}`} aria-label="Wstecz do klienta" className="lj-back">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/clients/${clientId}`} className="lj-client">
            {clientName}
          </Link>
          <h1 className="lj-title">{title}</h1>
          <div className="lj-meta">
            <span className="lj-badge">{jobStatusLabel(status)}</span>
            {dueDate && <span>termin {fmtDate(dueDate)}</span>}
          </div>
        </div>
        <div className="lj-hero-side">
          {amountGross > 0 && (
            <div className="lj-amount">
              <small>Wartość brutto</small>
              <Money as="b">{fmtPLN(amountGross)}</Money>
            </div>
          )}
          {menu}
        </div>
      </div>

      <nav aria-label="Etapy zlecenia" className="lj-steps">
        <ol>
          {PHASES.map((p, i) => {
            const state = closed || i < cur ? "done" : i === cur ? "cur" : "next";
            return (
              <li key={p.key} data-s={state}>
                <Link
                  href={`/jobs/${jobId}?faza=${p.key}`}
                  aria-current={view === p.key ? "page" : undefined}
                  data-sel={view === p.key}
                >
                  <i aria-hidden>{state === "done" ? "✓" : i + 1}</i>
                  <span>{p.label}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        <Link
          href={`/jobs/${jobId}?faza=finanse`}
          className="lj-fin"
          aria-current={view === "finanse" ? "page" : undefined}
          data-sel={view === "finanse"}
        >
          <i aria-hidden>zł</i>
          <span>Finanse</span>
        </Link>
      </nav>
    </header>
  );
}
