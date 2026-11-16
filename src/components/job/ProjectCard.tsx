import Link from "next/link";
import { isJobMissingSalesInvoice, type Job, type JobStatus } from "@/lib/dao/jobs.types";
import { jobStatusLabel, jobStatusTone } from "@/lib/jobStatusView";
import { PHASES, phaseOfStatus, phaseIndex } from "@/lib/jobPhases";
import { fmtPLN, fmtDate } from "@/lib/format";
import { Money } from "@/components/Money";
import { Badge } from "@/components/ui";

export function nextStep(job: Job): string {
  const steps: Partial<Record<JobStatus, string>> = {
    new_inquiry: "Umów pomiar",
    scheduled_measurement: "Zrób pomiar (skan)",
    to_measure: "Zrób pomiar (skan)",
    after_measure: "Uzupełnij dane po pomiarze",
    to_quote: "Przygotuj wycenę",
    quote_sent: "Czekasz na decyzję klienta",
    accepted: "Zamów materiały",
    materials_ordered: "Czekasz na materiał",
    in_production: "Produkcja w toku",
    ready_to_install: "Umów i zrób montaż",
  };
  if (job.status === "installed") {
    return isJobMissingSalesInvoice(job) ? "Wystaw fakturę" : "Rozlicz zlecenie";
  }
  return steps[job.status] ?? "";
}

export default function ProjectCard({
  job,
  todayIso,
  overdue,
  extra,
}: {
  job: Job & { client_name: string };
  todayIso: string;
  overdue: boolean;
  extra?: React.ReactNode;
}) {
  const amount = Number(job.amount_gross);
  const phase = phaseOfStatus(job.status);
  const cur = phase ? phaseIndex(phase) : -1;
  const step = nextStep(job);
  let dueLabel: string | null = null;
  if (job.due_date) {
    const days = Math.round(
      (new Date(job.due_date + "T00:00:00").getTime() - new Date(todayIso + "T00:00:00").getTime()) / 86_400_000,
    );
    dueLabel = overdue
      ? `${Math.abs(days)} dni po terminie`
      : days === 0
        ? "termin dziś"
        : days > 0 && days <= 14
          ? `termin za ${days} dni`
          : `termin ${fmtDate(job.due_date)}`;
  }
  return (
    <Link href={`/jobs/${job.id}`} role="listitem" className="lv-pcard">
      <div className="lv-pcard-top">
        <p className="lv-pcard-client">{job.client_name}</p>
        <Badge tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Badge>
      </div>
      <p className="lv-pcard-title">{job.title}</p>
      <ol className="lv-mini" aria-label="Etap zlecenia">
        {PHASES.map((p, i) => (
          <li key={p.key} data-s={i < cur ? "done" : i === cur ? "cur" : "next"}>
            <i aria-hidden />
            <span>{p.label}</span>
          </li>
        ))}
      </ol>
      <div className="lv-pcard-foot">
        <span className="lv-pcard-step">{step || "Otwórz zlecenie"}</span>
        <span className="text-right">
          {amount > 0 && <Money className="lv-pcard-amt">{fmtPLN(amount)}</Money>}
          {dueLabel && <small data-late={overdue}>{dueLabel}</small>}
        </span>
      </div>
      {extra}
    </Link>
  );
}

