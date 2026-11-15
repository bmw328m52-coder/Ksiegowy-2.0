import Link from "next/link";
import { JOB_STATUS_LABELS, JOB_STATUS_WORKFLOW, type JobStatus } from "@/lib/dao/jobs.types";
import {
  advanceJobStatusAction,
  confirmPomiarAction,
  confirmUzupelnienieAction,
  revertJobStatusAction,
} from "@/app/jobs/actions";

/**
 * Dolny pasek z głównym przejściem etapu zlecenia (ta sama logika co dawne StageActions).
 *
 * Pozycjonowanie: `sticky` wewnątrz kolumny treści zamiast `fixed` — dzięki temu na md+
 * pasek zawsze trzyma się szerokości kolumny (nie nachodzi na sidebar), a na telefonie
 * wystarczy podnieść `bottom` nad dolną nawigację (64px + safe-area, tak jak BottomNav).
 * ActiveTimerBar jest `fixed` (z-50) przy dolnej nawigacji na każdym breakpoincie i ma ok. 60px
 * wysokości; gdy jest w DOM (zielone tło `bg-emerald-700`), pasek podnosi się o 60px
 * selektorem `body:has(...)`, więc się nie nakładają. Pasek ma z-30 (pod timerem i nawigacją).
 */

const BTN_LABEL: Partial<Record<JobStatus, string>> = {
  new_inquiry: "Wykonaj pomiar",
  scheduled_measurement: "Wykonaj pomiar",
  to_measure: "Zatwierdź pomiar",
  after_measure: "Zatwierdź uzupełnienie",
  to_quote: "Wyślij wycenę",
  quote_sent: "Klient zaakceptował",
  accepted: "Materiały zamówione",
  materials_ordered: "Rozpocznij produkcję",
  in_production: "Gotowe do montażu",
  ready_to_install: "Zamontowane",
  installed: "Rozlicz zlecenie",
  settled: "Zarchiwizuj",
};

const HINT: Partial<Record<JobStatus, string>> = {
  scheduled_measurement: "Po zapisaniu briefu zlecenie trafi do uzupełnienia",
  to_measure: "Dalej: uzupełnienie ilości okuć",
  after_measure: "Dalej: wycena",
  to_quote: "Zmiana etapu na „Wycena wysłana”",
  quote_sent: "Zlecenie przejdzie do realizacji",
};

const BTN_CLASS =
  "w-full inline-flex items-center justify-between gap-2 rounded-2xl h-[54px] px-5 text-base font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-2)] active:opacity-90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export default function StageActionBar({
  jobId,
  status,
  completedDate,
  paidDate,
}: {
  jobId: string;
  status: JobStatus;
  completedDate: string | null;
  paidDate: string | null;
}) {
  if (status === "cancelled") return null;

  const idx = JOB_STATUS_WORKFLOW.indexOf(status);
  const canRevert = idx > 0;
  const canAdvance = idx >= 0 && idx < JOB_STATUS_WORKFLOW.length - 1;
  if (!canAdvance && !canRevert) return null;

  const nextStatus = canAdvance ? JOB_STATUS_WORKFLOW[idx + 1] : null;
  const prevLabel = canRevert ? JOB_STATUS_LABELS[JOB_STATUS_WORKFLOW[idx - 1]] : null;
  const revert = revertJobStatusAction.bind(null, jobId);

  const today = new Date().toISOString().slice(0, 10);
  const askDate =
    nextStatus === "installed"
      ? { label: "Kiedy zamontowane / zakończone?", value: completedDate ?? today }
      : nextStatus === "settled"
        ? { label: "Kiedy klient zapłacił?", value: paidDate ?? today }
        : null;

  const label =
    BTN_LABEL[status] ?? (nextStatus ? `Następny etap: ${JOB_STATUS_LABELS[nextStatus]}` : "");
  const hint =
    HINT[status] ??
    (nextStatus ? `Zmiana etapu na „${JOB_STATUS_LABELS[nextStatus]}”` : null);

  const arrow = <span aria-hidden>→</span>;
  let main: React.ReactNode = null;

  if (status === "scheduled_measurement") {
    main = (
      <Link href={`/jobs/${jobId}/pomiar/edit`} className={BTN_CLASS}>
        <span>{label}</span>
        {arrow}
      </Link>
    );
  } else if (status === "to_measure") {
    main = (
      <form action={confirmPomiarAction.bind(null, jobId)}>
        <button type="submit" className={BTN_CLASS}>
          <span>{label}</span>
          {arrow}
        </button>
      </form>
    );
  } else if (status === "after_measure") {
    main = (
      <form action={confirmUzupelnienieAction.bind(null, jobId)}>
        <button type="submit" className={BTN_CLASS}>
          <span>{label}</span>
          {arrow}
        </button>
      </form>
    );
  } else if (canAdvance) {
    main = (
      <form action={advanceJobStatusAction.bind(null, jobId)} className="flex flex-col gap-2">
        {askDate && (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 min-h-11">
            <span className="text-xs font-medium text-[var(--muted)]">{askDate.label}</span>
            <input
              type="date"
              name="date"
              required
              defaultValue={askDate.value}
              max={today}
              className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
          </label>
        )}
        <button type="submit" className={BTN_CLASS}>
          <span>{label}</span>
          {arrow}
        </button>
      </form>
    );
  }

  return (
    <div
      className="sticky z-30 bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-0 [body:has(.fixed.bg-emerald-700)_&]:bottom-[calc(124px+env(safe-area-inset-bottom))] md:[body:has(.fixed.bg-emerald-700)_&]:bottom-[60px] pointer-events-none"
      style={{
        background:
          "linear-gradient(to bottom, transparent 0%, var(--background) 28px)",
      }}
    >
      <div className="pointer-events-auto px-4 pt-8 pb-1 flex flex-col items-stretch gap-1">
        {main}
        {hint && (
          <p className="text-center text-[12.5px] text-[var(--muted)]">{hint}</p>
        )}
        {canRevert && (
          <form action={revert} className="flex justify-center">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 text-sm font-medium text-[var(--muted)] hover:text-[var(--accent-2)] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <span aria-hidden>←</span>
              <span>Cofnij do: {prevLabel}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Zapas na końcu treści strony, żeby ostatnia sekcja nie chowała się pod paskiem. */
export function StageActionBarSpacer() {
  return <div aria-hidden className="h-[120px]" />;
}
