import Link from "next/link";
import { notFound } from "next/navigation";
import JobHero, { parseJobView } from "@/components/job/JobHero";
import PhaseNowCard from "@/components/job/PhaseNowCard";
import StageActionBar from "@/components/job/StageActionBar";
import JobMenu from "@/components/job/JobMenu";
import { PHASES, phaseOfStatus, type PhaseContext } from "@/lib/jobPhases";
import { listMaterialsByJob } from "@/lib/dao/material_catalog";
import { getJob } from "@/lib/dao/jobs";
import { JOB_STATUS_LABELS, JOB_STATUS_WORKFLOW, type JobStatus, type CalcQuote } from "@/lib/dao/jobs.types";
import { fmtDate, fmtPLN } from "@/lib/format";
import { cancelJobAction, deleteJobAction, uncancelJobAction } from "../actions";
import InvoiceSection from "./InvoiceSection";
import MarginSection from "./MarginSection";
import PlanSection from "./PlanSection";
import LaborSection from "./LaborSection";
import PomiarSection from "./PomiarSection";
import RoomScanSection from "./RoomScanSection";
import ProjectFilesSection from "./ProjectFilesSection";
import ScanStatusCard from "./ScanStatusCard";
import { listScansByJob } from "@/lib/dao/room_scans";
import { getBriefByJob } from "@/lib/dao/quote_briefs";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  return { title: job?.title ?? "Zlecenie" };
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ faza?: string }>;
}) {
  const { id } = await params;
  const { faza } = await searchParams;
  const job = await getJob(id);
  if (!job) notFound();

  const [brief, scans, materials] = await Promise.all([
    getBriefByJob(id),
    listScansByJob(id),
    listMaterialsByJob(id),
  ]);
  const stages = buildStages(job);
  const currentPhase = phaseOfStatus(job.status) ?? "pomiar";
  const view = parseJobView(faza, currentPhase);
  const isCurrent = view === currentPhase;

  const phaseCtx: PhaseContext = {
    jobId: id,
    status: job.status,
    scanCount: scans.length,
    hasBrief: !!brief,
    hasQuote: !!job.calc_quote,
    hasMaterials: materials.length > 0,
    startDate: job.start_date,
    depositAmount: Number(job.deposit_amount) || 0,
    depositDate: job.deposit_date,
    dueDate: job.due_date,
    completedDate: job.completed_date,
    paidDate: job.paid_date,
    invoiced: job.invoiced,
    invoiceNumber: job.invoice_number,
  };

  const deleteWithIds = deleteJobAction.bind(null, id, job.client_id);
  const cancelWithId = cancelJobAction.bind(null, id);
  const uncancelWithId = uncancelJobAction.bind(null, id);
  const isCancelled = job.status === "cancelled";

  return (
    <main className="flex flex-1 flex-col px-4 py-5">
      <div className="lj-wrap">
        <JobHero
          jobId={id}
          clientId={job.client_id}
          clientName={job.client_name}
          title={job.title}
          status={job.status}
          amountGross={Number(job.amount_gross) || 0}
          dueDate={job.due_date}
          view={view}
          menu={
            <JobMenu
              jobId={id}
              status={job.status}
              cancelAction={cancelWithId}
              uncancelAction={uncancelWithId}
              deleteAction={deleteWithIds}
            />
          }
        />

        <div className="lj-body">
          {/* „Teraz” — tylko w bieżącym kroku, w pozostałych to podgląd kroku */}
          {isCurrent && <PhaseNowCard ctx={phaseCtx} />}
          {!isCurrent && view !== "finanse" && (
            <p className="lj-peek">
              Podgląd kroku. Bieżący krok zlecenia to{" "}
              <Link href={`/jobs/${id}`}>{PHASES.find((p) => p.key === currentPhase)?.label}</Link>.
            </p>
          )}

          {view === "pomiar" && (
            <div id="skan" className="space-y-4">
              <ProjectFilesSection jobId={id} />
              <ScanStatusCard jobId={id} scans={scans} />
              <PomiarSection jobId={id} brief={brief} scanned={scans.length > 0} />
              <RoomScanSection jobId={id} scans={scans} />
            </div>
          )}

          {view === "wycena" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <QuickLink href={`/jobs/${id}/wycena`} title="Wycena" hint="Pozycje i materiały, potem cena i rentowność" />
                <QuickLink href={`/calculator?job=${id}`} title="Kalkulator" hint="Kwota na rękę i rentowność" />
              </div>
              {job.calc_quote ? (
                <CalcQuoteCard q={job.calc_quote} />
              ) : (
                <p className="lj-peek">Wycena z kalkulatora pojawi się tu po zapisaniu.</p>
              )}
              {scans.length > 0 && <ScanStatusCard jobId={id} scans={scans} />}
            </>
          )}

          {view === "akceptacja" && (
            <>
              {job.calc_quote && <CalcQuoteCard q={job.calc_quote} />}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <QuickLink href={`/jobs/${id}/wycena`} title="Wycena" hint="Zobacz lub popraw pozycje" />
                <QuickLink href={`/jobs/${id}?faza=finanse#plan`} title="Zaliczka i plan" hint="Plan z kalkulatora kontra wykonanie" />
              </div>
            </>
          )}

          {view === "produkcja" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <QuickLink href={`/jobs/${id}/zakupy`} title="Lista zakupów" hint="Co kupić, wg dostawcy" />
                <QuickLink href={`/jobs/${id}/wycena`} title="Pozycje i okucia" hint="Co dokładnie jest w zleceniu" />
              </div>
              {!isCancelled && (
                <LaborSection jobId={id} defaultDate={job.completed_date ?? new Date().toISOString().slice(0, 10)} />
              )}
            </>
          )}

          {view === "montaz" && (
            <>
              {job.calc_quote && <CalcQuoteCard q={job.calc_quote} />}
              <QuickLink href={`/jobs/${id}?faza=finanse#faktura`} title="Faktura i rozliczenie" hint="Wystaw fakturę, zaznacz płatność" wide />
            </>
          )}

          {view === "finanse" && (
            <div className="space-y-4">
              {!isCancelled && <MarginSection job={job} />}
              {job.calc_quote && <CalcQuoteCard q={job.calc_quote} />}
              {!isCancelled && job.calc_quote?.plan?.input && (
                <div id="plan">
                  <PlanSection job={job} plan={job.calc_quote.plan} savedAt={job.calc_quote.savedAt} />
                </div>
              )}
              <div id="faktura">
                <InvoiceSection
                  jobId={id}
                  invoiced={job.invoiced}
                  invoiceNumber={job.invoice_number}
                  invoiceDate={job.invoice_date}
                  amountGross={Number(job.amount_gross) || 0}
                  status={job.status}
                />
              </div>
              {!isCancelled && (
                <LaborSection jobId={id} defaultDate={job.completed_date ?? new Date().toISOString().slice(0, 10)} />
              )}
            </div>
          )}

          {job.notes && view !== "finanse" && (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-[11px] font-semibold text-[var(--muted)] mb-2">Notatki</p>
              <p className="whitespace-pre-wrap text-sm text-[var(--ink-2)]">{job.notes}</p>
            </section>
          )}

          <details className="group">
            <FoldSummary>Historia etapów</FoldSummary>
            <StageTimeline stages={stages} />
          </details>
        </div>

        <StageActionBar
          jobId={id}
          status={job.status}
          completedDate={job.completed_date}
          paidDate={job.paid_date}
        />
      </div>
    </main>
  );
}

function FoldSummary({ children }: { children: React.ReactNode }) {
  return (
    <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--ink-2)] [&::-webkit-details-marker]:hidden">
      {children}
      <span aria-hidden className="text-[var(--muted)] transition-transform group-open:rotate-180">⌄</span>
    </summary>
  );
}

function QuickLink({ href, title, hint, wide }: { href: string; title: string; hint: string; wide?: boolean }) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border border-[var(--border)] bg-white p-4 text-sm font-medium text-[var(--foreground)] active:bg-[var(--surface-2)] transition-colors${wide ? " sm:col-span-2" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span>{title}</span>
        <span className="text-[var(--muted)]">→</span>
      </div>
      <p className="text-xs text-[var(--muted)] mt-1">{hint}</p>
    </Link>
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
            ? `zaliczka ${fmtPLN(Number(job.deposit_amount))}`
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
      <p className="text-[11px] font-semibold text-[#8d8a85] mb-3">
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
                      <span className="ml-2 inline-block text-[10px] font-semibold text-white rounded-full px-1.5 py-0.5 align-middle"
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

// Wycena przeniesiona z kalkulatora — pokazuje kwotę/koszty/zysk 1:1 z kalkulatorem
// (z ZUS-em i rezerwą urlop/L4, jeśli były policzone). Źródło: jobs.calc_quote.
function CalcQuoteCard({ q }: { q: CalcQuote }) {
  const marginPct = q.amountGross > 0 ? (q.profit / q.amountGross) * 100 : null;
  return (
    <section className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] font-semibold text-[var(--accent)]">
          Wycena z kalkulatora
        </p>
        <span className="text-[10px] text-[var(--accent)]">
          {q.withInvoice ? "z fakturą" : "bez faktury"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-[#8d8a85] ">Kwota</p>
          <p className="font-semibold text-sm tabular-nums text-[#1f1d1b]">{fmtPLN(q.amountGross)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#8d8a85] ">Koszty</p>
          <p className="font-semibold text-sm tabular-nums text-[#1f1d1b]">{fmtPLN(q.costsGross)}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#8d8a85] ">Zysk</p>
          <p className="font-semibold text-sm tabular-nums text-[#3a6b4d]">{fmtPLN(q.profit)}</p>
        </div>
      </div>
      {(q.zus > 0 || (q.rent ?? 0) > 0 || q.reserve > 0) && (
        <div className="mt-2.5 pt-2.5 border-t border-[#e7d3b3] text-[11px] text-[#7d5530] space-y-0.5">
          {q.zus > 0 && (
            <div className="flex justify-between">
              <span>ZUS (część zlecenia{q.hours > 0 ? `, ${q.hours} h` : ""})</span>
              <span className="tabular-nums">− {fmtPLN(q.zus)}</span>
            </div>
          )}
          {(q.rent ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Warsztat (czynsz + prąd)</span>
              <span className="tabular-nums">− {fmtPLN(q.rent ?? 0)}</span>
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
          <span className="text-[11px] font-medium text-[var(--accent)]">marża {marginPct.toFixed(1)}%</span>
        )}
        <span className="text-[10px] text-[var(--muted)]">przeniesione z kalkulatora · {fmtDate(q.savedAt)}</span>
      </div>
    </section>
  );
}
