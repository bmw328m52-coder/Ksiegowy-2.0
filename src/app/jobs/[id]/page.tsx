import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getJob } from "@/lib/dao/jobs";
import { JOB_STATUS_LABELS, JOB_STATUS_WORKFLOW, type JobStatus, type CalcQuote } from "@/lib/dao/jobs.types";
import { fmtDate, fmtPLN } from "@/lib/format";
import {
  advanceJobStatusAction,
  cancelJobAction,
  confirmPomiarAction,
  confirmUzupelnienieAction,
  deleteJobAction,
  revertJobStatusAction,
  uncancelJobAction,
} from "../actions";
import InvoiceSection from "./InvoiceSection";
import MarginSection from "./MarginSection";
import PomiarSection from "./PomiarSection";
import { getBriefByJob } from "@/lib/dao/quote_briefs";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  return { title: job?.title ?? "Zlecenie" };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  const brief = await getBriefByJob(id);
  const stages = buildStages(job);

  const deleteWithIds = deleteJobAction.bind(null, id, job.client_id);
  const cancelWithId = cancelJobAction.bind(null, id);
  const uncancelWithId = uncancelJobAction.bind(null, id);
  const isCancelled = job.status === "cancelled";
  const canCancel = !isCancelled && job.status !== "settled" && job.status !== "archived";

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md sm:max-w-lg mx-auto">
        <PageHeader
          title={job.title}
          back={{ href: `/clients/${job.client_id}` }}
          action={
            <ButtonLink href={`/jobs/${id}/edit`} variant="secondary" size="sm">
              Edytuj
            </ButtonLink>
          }
        />

        <section className="rounded-xl border border-[#ededea] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8d8a85]">Klient</span>
            <Link
              href={`/clients/${job.client_id}`}
              className="text-sm font-medium text-[#1f1d1b] underline-offset-2 hover:underline"
            >
              {job.client_name}
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8d8a85]">Etap</span>
            <StatusPill status={job.status} />
          </div>
        </section>

        {job.calc_quote && <CalcQuoteCard q={job.calc_quote} />}

        <Link
          href={`/jobs/${id}/wycena`}
          className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#a06f3f] px-4 py-3.5 text-white shadow-[0_2px_8px_rgba(160,111,63,0.18)] hover:bg-[#7d5530] active:opacity-90 transition-colors"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M8 6h8" />
              <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
            </svg>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold">Wycena pozycji</span>
              <span className="text-[11px] text-white/80 truncate">Pozycje, materiały i ceny</span>
            </span>
          </span>
          <span aria-hidden className="text-white/90">→</span>
        </Link>

        <StageActions jobId={id} status={job.status} />

        <StageTimeline stages={stages} />

        <PomiarSection jobId={id} brief={brief} />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Link
            href={`/jobs/${id}/zakupy`}
            className="block rounded-xl border border-[#ededea] bg-white p-4 text-sm font-medium text-[#1f1d1b] active:bg-[#f6f6f5] hover:border-[#d8d7d3] transition-colors"
          >
            <div className="flex items-center justify-between">
              <span>Lista zakupów</span>
              <span className="text-[#8d8a85]">→</span>
            </div>
            <p className="text-xs text-[#8d8a85] mt-1">
              Co kupić, wg dostawcy
            </p>
          </Link>
          <Link
            href={`/calculator?job=${id}`}
            className="block rounded-xl border border-[#ededea] bg-white p-4 text-sm font-medium text-[#1f1d1b] active:bg-[#f6f6f5] hover:border-[#d8d7d3] transition-colors"
          >
            <div className="flex items-center justify-between">
              <span>Kalkulator wyceny</span>
              <span className="text-[#8d8a85]">→</span>
            </div>
            <p className="text-xs text-[#8d8a85] mt-1">
              Marża, VAT, PIT, ZUS — na czysto
            </p>
          </Link>
        </div>

        <InvoiceSection
          jobId={id}
          invoiced={job.invoiced}
          invoiceNumber={job.invoice_number}
          invoiceDate={job.invoice_date}
          amountGross={Number(job.amount_gross) || 0}
          status={job.status}
        />

        {!isCancelled && <MarginSection job={job} />}

        {job.notes && (
          <section className="mt-4 rounded-xl border border-[#ededea] bg-white p-4">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-[#8d8a85] mb-2">
              Notatki
            </p>
            <p className="whitespace-pre-wrap text-sm text-[#6f6c66]">
              {job.notes}
            </p>
          </section>
        )}

        <div className="mt-10 flex flex-col gap-1">
          {canCancel && (
            <form action={cancelWithId}>
              <ConfirmSubmitButton
                message="Anulować to zlecenie? Status zmieni się na „Anulowane”. Można to później cofnąć."
                formNoValidate
                className="w-full text-sm text-[#8d8a85] py-3 hover:text-[#3a3633] active:underline"
              >
                Anuluj zlecenie
              </ConfirmSubmitButton>
            </form>
          )}
          {isCancelled && (
            <form action={uncancelWithId}>
              <button
                type="submit"
                className="w-full text-sm text-[#a06f3f] py-3 hover:text-[#7d5530] active:underline"
              >
                Przywróć (do „Nowe zapytanie”)
              </button>
            </form>
          )}
          <form action={deleteWithIds}>
            <ConfirmSubmitButton
              message="Na pewno usunąć to zlecenie? Tej operacji nie da się cofnąć."
              formNoValidate
              className="w-full text-sm text-red-600 py-3 active:underline"
            >
              Usuń zlecenie
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </main>
  );
}

type StageState = "done" | "current" | "upcoming" | "skipped";

type Stage = {
  key: string;
  label: string;
  date: string | null;
  state: StageState;
  hint?: string;
};

// Mapowanie etapu workflow na opcjonalną datę i hint z rekordu zlecenia
function stageDate(
  status: JobStatus,
  job: Awaited<ReturnType<typeof getJob>> & object,
): { date: string | null; hint?: string } {
  switch (status) {
    case "scheduled_measurement":
      return { date: job.start_date, hint: job.start_date ? "pomiar umówiony" : undefined };
    case "to_measure":
      return { date: job.start_date, hint: job.start_date ? "pomiar zaplanowany" : undefined };
    case "accepted":
      return {
        date: job.deposit_date,
        hint:
          Number(job.deposit_amount) > 0
            ? `zaliczka ${Number(job.deposit_amount).toFixed(2)} zł`
            : undefined,
      };
    case "in_production":
      return { date: job.due_date, hint: job.due_date ? `termin ${fmtDate(job.due_date)}` : undefined };
    case "installed":
      return { date: job.completed_date };
    case "settled":
      return {
        date: job.paid_date ?? job.invoice_date,
        hint: job.invoice_number ? `FV ${job.invoice_number}` : undefined,
      };
    default:
      return { date: null };
  }
}

function buildStages(job: Awaited<ReturnType<typeof getJob>> & object): Stage[] {
  if (job.status === "cancelled") {
    return [
      {
        key: "created",
        label: "Utworzono",
        date: job.created_at.slice(0, 10),
        state: "done",
      },
      { key: "cancelled", label: "Anulowane", date: null, state: "done" },
    ];
  }

  const currentIdx = JOB_STATUS_WORKFLOW.indexOf(job.status);

  return JOB_STATUS_WORKFLOW.map((s, i) => {
    const { date, hint } = stageDate(s, job);
    const state: StageState =
      i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming";
    return {
      key: s,
      label: JOB_STATUS_LABELS[s],
      date,
      state,
      hint,
    };
  });
}

const STAGE_KEY_TONE: Record<string, string> = {
  new_inquiry: "#c9c7c2",
  scheduled_measurement: "#a06f3f",
  to_measure: "#a06f3f",
  after_measure: "#a06f3f",
  to_quote: "#a18653",
  quote_sent: "#a18653",
  accepted: "#5a7898",
  materials_ordered: "#5a7898",
  in_production: "#5a7898",
  ready_to_install: "#4f8a64",
  installed: "#4f8a64",
  settled: "#3a6b4d",
  archived: "#c9c7c2",
  cancelled: "#c9c7c2",
  created: "#c9c7c2",
};

function toneForKey(key: string): string {
  return STAGE_KEY_TONE[key] ?? "#a06f3f";
}

function StageTimeline({ stages }: { stages: Stage[] }) {
  return (
    <section className="mt-4 rounded-xl border border-[#ededea] bg-white p-4">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-[#8d8a85] mb-3">
        Etapy zlecenia
      </p>
      <ol className="relative pl-2">
        {stages.map((s, i) => {
          const last = i === stages.length - 1;
          const tone = toneForKey(s.key);
          const nextTone = !last ? toneForKey(stages[i + 1].key) : tone;
          return (
            <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0">
              <div className="relative flex flex-col items-center shrink-0">
                <StageDot state={s.state} tone={tone} />
                {!last && (
                  <StageConnector state={s.state} tone={nextTone} />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={[
                      "text-sm font-medium truncate",
                      s.state === "done"
                        ? "text-[#1f1d1b]"
                        : s.state === "current"
                          ? "text-[#1f1d1b]"
                          : s.state === "upcoming"
                            ? "text-[#6f6c66]"
                            : "text-[#c9c7c2] line-through",
                    ].join(" ")}
                  >
                    {s.label}
                    {s.state === "current" && (
                      <span className="ml-2 inline-block text-[10px] uppercase tracking-wide font-semibold text-white rounded-full px-1.5 py-0.5 align-middle"
                        style={{ backgroundColor: tone }}
                      >
                        teraz
                      </span>
                    )}
                  </p>
                  {s.date && (
                    <span className="text-[11px] tabular-nums text-[#8d8a85] shrink-0">
                      {fmtDate(s.date)}
                    </span>
                  )}
                </div>
                {s.hint && (
                  <p className="text-[11px] text-[#8d8a85] mt-0.5">{s.hint}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StageDot({ state, tone }: { state: StageState; tone: string }) {
  if (state === "done") {
    return (
      <span
        aria-hidden
        className="w-3 h-3 rounded-full border-2"
        style={{ backgroundColor: tone, borderColor: tone }}
      />
    );
  }
  if (state === "current") {
    return (
      <span
        aria-hidden
        className="w-3 h-3 rounded-full border-2 bg-white"
        style={{
          borderColor: tone,
          boxShadow: `0 0 0 3px ${tone}26`,
        }}
      />
    );
  }
  if (state === "skipped") {
    return <span aria-hidden className="w-3 h-3 rounded-full border-2 bg-[#f0f0ee] border-[#ededea]" />;
  }
  return <span aria-hidden className="w-3 h-3 rounded-full border-2 bg-white border-[#ededea]" />;
}

function StageConnector({ state, tone }: { state: StageState; tone: string }) {
  const style =
    state === "done" ? { backgroundColor: tone } : { backgroundColor: "#ededea" };
  return <span aria-hidden className="mt-0.5 w-0.5 flex-1 min-h-[14px]" style={style} />;
}

function StageActions({ jobId, status }: { jobId: string; status: JobStatus }) {
  if (status === "cancelled") return null;

  const idx = JOB_STATUS_WORKFLOW.indexOf(status);
  const canRevert = idx > 0;
  const prevLabel = canRevert ? JOB_STATUS_LABELS[JOB_STATUS_WORKFLOW[idx - 1]] : null;
  const revert = revertJobStatusAction.bind(null, jobId);

  const revertBtn = canRevert ? (
    <form action={revert}>
      <button
        type="submit"
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#6f6c66] bg-[#f6f6f5] border border-[#ededea] hover:bg-[#eeeeed] active:opacity-80 transition-colors"
      >
        <span aria-hidden>←</span>
        <span>Cofnij do: {prevLabel}</span>
      </button>
    </form>
  ) : null;

  if (status === "scheduled_measurement") {
    return (
      <section className="mt-3 rounded-xl border border-[#ededea] bg-white p-3 flex flex-col gap-2">
        <Link
          href={`/jobs/${jobId}/pomiar/edit`}
          className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-[#a06f3f] hover:bg-[#7d5530] active:opacity-90 transition-colors"
        >
          <span>Wykonaj pomiar →</span>
          <span aria-hidden>→</span>
        </Link>
        <p className="text-[11px] text-[#8d8a85]">
          Wypełnij brief po wizycie u klienta — po zapisaniu zlecenie trafi od razu do „Uzupełnienia”.
        </p>
        {revertBtn}
      </section>
    );
  }

  if (status === "to_measure") {
    const confirmPomiar = confirmPomiarAction.bind(null, jobId);
    return (
      <section className="mt-3 rounded-xl border border-[#ededea] bg-white p-3 flex flex-col gap-2">
        <form action={confirmPomiar}>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-[#a06f3f] hover:bg-[#7d5530] active:opacity-90 transition-colors"
          >
            <span>Zatwierdź pomiar → Uzupełnienie</span>
            <span aria-hidden>→</span>
          </button>
        </form>
        <p className="text-[11px] text-[#8d8a85]">
          Po zatwierdzeniu zlecenie trafi do etapu „Uzupełnienie” — tam dopiszesz ilości okuć, szuflad, LED-ów itd. dla wyceny.
        </p>
        {revertBtn}
      </section>
    );
  }

  if (status === "after_measure") {
    const confirmUzup = confirmUzupelnienieAction.bind(null, jobId);
    return (
      <section className="mt-3 rounded-xl border border-[#ededea] bg-white p-3 flex flex-col gap-2">
        <form action={confirmUzup}>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-[#a06f3f] hover:bg-[#7d5530] active:opacity-90 transition-colors"
          >
            <span>Zatwierdź uzupełnienie → Wycena</span>
            <span aria-hidden>→</span>
          </button>
        </form>
        <p className="text-[11px] text-[#8d8a85]">
          Po zatwierdzeniu zlecenie trafi do „Wyceny” — gotowy komplet danych do kalkulatora i listy zakupów.
        </p>
        {revertBtn}
      </section>
    );
  }

  const canAdvance = idx >= 0 && idx < JOB_STATUS_WORKFLOW.length - 1;
  if (!canAdvance && !canRevert) return null;
  const nextLabel = canAdvance ? JOB_STATUS_LABELS[JOB_STATUS_WORKFLOW[idx + 1]] : null;
  const advance = advanceJobStatusAction.bind(null, jobId);

  return (
    <section className="mt-3 rounded-xl border border-[#ededea] bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      {canAdvance && (
        <form action={advance} className="flex-1">
          <button
            type="submit"
            className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-[#a06f3f] hover:bg-[#7d5530] active:opacity-90 transition-colors"
          >
            <span>Następny etap: {nextLabel}</span>
            <span aria-hidden>→</span>
          </button>
        </form>
      )}
      {canRevert && (
        <div className={canAdvance ? "sm:w-auto" : "flex-1"}>
          {revertBtn}
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    new_inquiry: "bg-[#f0f0ee] text-[#8d8a85]",
    scheduled_measurement: "bg-[#f1e5d2] text-[#7d5530]",
    to_measure: "bg-[#f1e5d2] text-[#7d5530]",
    after_measure: "bg-[#f1e5d2] text-[#7d5530]",
    to_quote: "bg-[#faf5e9] text-[#a18653]",
    quote_sent: "bg-[#faf5e9] text-[#a18653]",
    accepted: "bg-[#dde5ef] text-[#5a7898]",
    materials_ordered: "bg-[#dde5ef] text-[#5a7898]",
    in_production: "bg-[#dde5ef] text-[#5a7898]",
    ready_to_install: "bg-[#e3efe5] text-[#4f8a64]",
    installed: "bg-[#e3efe5] text-[#4f8a64]",
    settled: "bg-[#e3efe5] text-[#3a6b4d]",
    archived: "bg-[#f0f0ee] text-[#8d8a85]",
    cancelled: "bg-[#f0f0ee] text-[#8d8a85] line-through",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}

// Wycena przeniesiona z kalkulatora — pokazuje kwotę/koszty/zysk 1:1 z kalkulatorem
// (z ZUS-em i rezerwą urlop/L4, jeśli były policzone). Źródło: jobs.calc_quote.
function CalcQuoteCard({ q }: { q: CalcQuote }) {
  const marginPct = q.amountGross > 0 ? (q.profit / q.amountGross) * 100 : null;
  return (
    <section className="mt-3 rounded-xl border border-[#e2c79c] bg-[linear-gradient(160deg,#fbf1dd,#fff8e9)] p-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#a18653]">
          Wycena z kalkulatora
        </p>
        <span className="text-[10px] text-[#a18653]">
          {q.withInvoice ? "z fakturą" : "bez faktury"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-[#8d8a85] uppercase tracking-wide">Kwota</p>
          <p className="font-semibold text-sm tabular-nums text-[#1f1d1b]">{fmtPLN(q.amountGross)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#8d8a85] uppercase tracking-wide">Koszty</p>
          <p className="font-semibold text-sm tabular-nums text-[#1f1d1b]">{fmtPLN(q.costsGross)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#8d8a85] uppercase tracking-wide">Zysk</p>
          <p className="font-semibold text-sm tabular-nums text-[#3a6b4d]">{fmtPLN(q.profit)}</p>
        </div>
      </div>
      {(q.zus > 0 || q.reserve > 0) && (
        <div className="mt-2.5 pt-2.5 border-t border-[#e7d3b3] text-[11px] text-[#7d5530] space-y-0.5">
          {q.zus > 0 && (
            <div className="flex justify-between">
              <span>ZUS (część zlecenia{q.hours > 0 ? `, ${q.hours} h` : ""})</span>
              <span className="tabular-nums">− {fmtPLN(q.zus)}</span>
            </div>
          )}
          {q.reserve > 0 && (
            <div className="flex justify-between">
              <span>Rezerwa urlop/L4</span>
              <span className="tabular-nums">− {fmtPLN(q.reserve)}</span>
            </div>
          )}
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between">
        {marginPct !== null && (
          <span className="text-[11px] font-medium text-[#a18653]">marża {marginPct.toFixed(1)}%</span>
        )}
        <span className="text-[10px] text-[#b3b0aa]">przeniesione z kalkulatora · {fmtDate(q.savedAt)}</span>
      </div>
    </section>
  );
}
