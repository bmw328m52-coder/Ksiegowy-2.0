import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getJob } from "@/lib/dao/jobs";
import { JOB_STATUS_LABELS, JOB_STATUS_WORKFLOW, type JobStatus } from "@/lib/dao/jobs.types";
import { fmtDate } from "@/lib/format";
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
            <Link
              href={`/jobs/${id}/edit`}
              className="text-sm text-[#6b6661] underline-offset-2 hover:underline"
            >
              Edytuj
            </Link>
          }
        />

        <section className="rounded-xl border border-[#e8e4dd] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9c9081]">Klient</span>
            <Link
              href={`/clients/${job.client_id}`}
              className="text-sm font-medium text-[#282624] underline-offset-2 hover:underline"
            >
              {job.client_name}
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9c9081]">Etap</span>
            <StatusPill status={job.status} />
          </div>
        </section>

        <StageActions jobId={id} status={job.status} />

        <StageTimeline stages={stages} />

        <PomiarSection jobId={id} brief={brief} />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Link
            href={`/jobs/${id}/wycena`}
            className="block rounded-xl border border-[#e8e4dd] bg-white p-4 text-sm font-medium text-[#282624] active:bg-[#faf7f2] hover:border-[#d8d2c8] transition-colors"
          >
            <div className="flex items-center justify-between">
              <span>Wycena pozycji</span>
              <span className="text-[#9c9081]">→</span>
            </div>
            <p className="text-xs text-[#9c9081] mt-1">
              Lista pozycji i materiały
            </p>
          </Link>
          <Link
            href={`/jobs/${id}/zakupy`}
            className="block rounded-xl border border-[#e8e4dd] bg-white p-4 text-sm font-medium text-[#282624] active:bg-[#faf7f2] hover:border-[#d8d2c8] transition-colors"
          >
            <div className="flex items-center justify-between">
              <span>Lista zakupów</span>
              <span className="text-[#9c9081]">→</span>
            </div>
            <p className="text-xs text-[#9c9081] mt-1">
              Co kupić, wg dostawcy
            </p>
          </Link>
          <Link
            href={`/calculator?job=${id}`}
            className="block rounded-xl border border-[#e8e4dd] bg-white p-4 text-sm font-medium text-[#282624] active:bg-[#faf7f2] hover:border-[#d8d2c8] transition-colors"
          >
            <div className="flex items-center justify-between">
              <span>Kalkulator wyceny</span>
              <span className="text-[#9c9081]">→</span>
            </div>
            <p className="text-xs text-[#9c9081] mt-1">
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
          <section className="mt-4 rounded-xl border border-[#e8e4dd] bg-white p-4">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-[#9c9081] mb-2">
              Notatki
            </p>
            <p className="whitespace-pre-wrap text-sm text-[#524d48]">
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
                className="w-full text-sm text-[#9c9081] py-3 hover:text-[#3a3633] active:underline"
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
  new_inquiry: "#c4bbac",
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
  archived: "#c4bbac",
  cancelled: "#c4bbac",
  created: "#c4bbac",
};

function toneForKey(key: string): string {
  return STAGE_KEY_TONE[key] ?? "#a06f3f";
}

function StageTimeline({ stages }: { stages: Stage[] }) {
  return (
    <section className="mt-4 rounded-xl border border-[#e8e4dd] bg-white p-4">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-[#9c9081] mb-3">
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
                        ? "text-[#282624]"
                        : s.state === "current"
                          ? "text-[#282624]"
                          : s.state === "upcoming"
                            ? "text-[#6b6661]"
                            : "text-[#c4bbac] line-through",
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
                    <span className="text-[11px] tabular-nums text-[#9c9081] shrink-0">
                      {fmtDate(s.date)}
                    </span>
                  )}
                </div>
                {s.hint && (
                  <p className="text-[11px] text-[#9c9081] mt-0.5">{s.hint}</p>
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
    return <span aria-hidden className="w-3 h-3 rounded-full border-2 bg-[#f5f3ef] border-[#e8e4dd]" />;
  }
  return <span aria-hidden className="w-3 h-3 rounded-full border-2 bg-white border-[#e8e4dd]" />;
}

function StageConnector({ state, tone }: { state: StageState; tone: string }) {
  const style =
    state === "done" ? { backgroundColor: tone } : { backgroundColor: "#e8e4dd" };
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
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#6f6457] bg-[#faf7f2] border border-[#e8e4dd] hover:bg-[#f1ede5] active:opacity-80 transition-colors"
      >
        <span aria-hidden>←</span>
        <span>Cofnij do: {prevLabel}</span>
      </button>
    </form>
  ) : null;

  if (status === "scheduled_measurement") {
    return (
      <section className="mt-3 rounded-xl border border-[#e8e4dd] bg-white p-3 flex flex-col gap-2">
        <Link
          href={`/jobs/${jobId}/pomiar/edit`}
          className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-[#a06f3f] hover:bg-[#7d5530] active:opacity-90 transition-colors"
        >
          <span>Wykonaj pomiar →</span>
          <span aria-hidden>→</span>
        </Link>
        <p className="text-[11px] text-[#9c9081]">
          Wypełnij brief po wizycie u klienta — po zapisaniu zlecenie trafi od razu do „Uzupełnienia”.
        </p>
        {revertBtn}
      </section>
    );
  }

  if (status === "to_measure") {
    const confirmPomiar = confirmPomiarAction.bind(null, jobId);
    return (
      <section className="mt-3 rounded-xl border border-[#e8e4dd] bg-white p-3 flex flex-col gap-2">
        <form action={confirmPomiar}>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-[#a06f3f] hover:bg-[#7d5530] active:opacity-90 transition-colors"
          >
            <span>Zatwierdź pomiar → Uzupełnienie</span>
            <span aria-hidden>→</span>
          </button>
        </form>
        <p className="text-[11px] text-[#9c9081]">
          Po zatwierdzeniu zlecenie trafi do etapu „Uzupełnienie” — tam dopiszesz ilości okuć, szuflad, LED-ów itd. dla wyceny.
        </p>
        {revertBtn}
      </section>
    );
  }

  if (status === "after_measure") {
    const confirmUzup = confirmUzupelnienieAction.bind(null, jobId);
    return (
      <section className="mt-3 rounded-xl border border-[#e8e4dd] bg-white p-3 flex flex-col gap-2">
        <form action={confirmUzup}>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-[#a06f3f] hover:bg-[#7d5530] active:opacity-90 transition-colors"
          >
            <span>Zatwierdź uzupełnienie → Wycena</span>
            <span aria-hidden>→</span>
          </button>
        </form>
        <p className="text-[11px] text-[#9c9081]">
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
    <section className="mt-3 rounded-xl border border-[#e8e4dd] bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-center">
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
    new_inquiry: "bg-[#f5f3ef] text-[#9c9081]",
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
    archived: "bg-[#f5f3ef] text-[#9c9081]",
    cancelled: "bg-[#f5f3ef] text-[#9c9081] line-through",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
