import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";
import { getDashboardData, MONTH_NAMES_PL } from "@/lib/dao/dashboard";
import { listJobs } from "@/lib/dao/jobs";
import {
  isJobMissingSalesInvoice,
  JOB_STATUS_WORKFLOW,
  type Job,
  type JobStatus,
} from "@/lib/dao/jobs.types";
import { jobStatusLabel, jobStatusTone } from "@/lib/jobStatusView";
import {
  getActiveTimer,
  getJobMeta,
  WORK_PHASE_LABELS,
} from "@/lib/dao/time_entries";
import { fmtPLN, fmtDate } from "@/lib/format";
import ActiveTimerHomeCard from "@/components/ActiveTimerHomeCard";
import { Money } from "@/components/Money";
import UserAvatarMenu from "@/components/UserAvatarMenu";
import PrivateModeToggle from "@/components/PrivateModeToggle";
import { Badge, PageContainer, SectionHeading, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [dash, active, jobs] = await Promise.all([
    getDashboardData().catch(() => null),
    getActiveTimer().catch(() => null),
    listJobs().catch(() => [] as Awaited<ReturnType<typeof listJobs>>),
  ]);
  const activeJob = active ? await getJobMeta(active.job_id).catch(() => null) : null;

  const today = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const firstName = (() => {
    if (!user?.email) return "Artur";
    const raw = user.email.split("@")[0].split(/[._-]/)[0];
    if (!/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{2,}$/.test(raw)) return "Artur";
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  })();
  const avatarInitial = firstName ? firstName[0]!.toUpperCase() : "?";

  const monthName = dash ? MONTH_NAMES_PL[dash.month_index] : "";
  const urgentReminders =
    dash?.reminders.filter((r) => r.daysUntil <= 7).slice(0, 3) ?? [];

  // ── Liczniki do nagłówka + lista zleceń w toku ─────────────────────────
  const todayIso = new Date().toISOString().slice(0, 10);
  const agendaToIso = new Date(new Date().getTime() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const CLOSED = new Set(["settled", "archived", "cancelled"]);
  const DONE = new Set(["installed", "settled", "archived"]);
  const skrzynka = {
    active: jobs.filter((j) => !CLOSED.has(j.status)).length,
    overdueCount: jobs.filter(
      (j) =>
        !DONE.has(j.status) &&
        j.status !== "cancelled" &&
        j.due_date !== null &&
        j.due_date < todayIso,
    ).length,
  };

  // Zlecenia w toku: najpierw po terminie, potem z najbliższym terminem, dalej najbardziej zaawansowane.
  const isOverdue = (j: Job) =>
    !DONE.has(j.status) && j.due_date !== null && j.due_date < todayIso;
  const openJobs = jobs
    .filter((j) => !CLOSED.has(j.status))
    .sort((a, b) => {
      const o = Number(isOverdue(b)) - Number(isOverdue(a));
      if (o !== 0) return o;
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      return JOB_STATUS_WORKFLOW.indexOf(b.status) - JOB_STATUS_WORKFLOW.indexOf(a.status);
    });
  const shownJobs = openJobs.slice(0, 8);

  // ── Agenda dnia — pomiary/montaże/terminy w 14 dni ──────────────────────
  type AgendaItem = {
    jobId: string;
    title: string;
    clientName: string;
    dateIso: string;
    kind: "measure" | "deadline" | "install";
  };
  const agendaItems: AgendaItem[] = [];
  for (const j of jobs) {
    if (CLOSED.has(j.status) || j.status === "cancelled") continue;
    if (
      j.start_date &&
      j.start_date >= todayIso &&
      j.start_date <= agendaToIso &&
      !DONE.has(j.status)
    ) {
      agendaItems.push({
        jobId: j.id,
        title: j.title,
        clientName: j.client_name,
        dateIso: j.start_date,
        kind: j.status === "ready_to_install" ? "install" : "measure",
      });
    }
    if (
      j.due_date &&
      j.due_date >= todayIso &&
      j.due_date <= agendaToIso &&
      !DONE.has(j.status)
    ) {
      agendaItems.push({
        jobId: j.id,
        title: j.title,
        clientName: j.client_name,
        dateIso: j.due_date,
        kind: "deadline",
      });
    }
  }
  agendaItems.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  const agenda = agendaItems.slice(0, 6);

  const vatInfo = dash?.vat ?? null;
  // Brutto najpierw; netto drobnym tylko, gdy faktycznie się różni (VAT-owiec).
  const profitGross = dash ? dash.month.revenueGross - dash.month.costsGross : 0;
  const showNet = dash
    ? Math.abs(dash.month.revenueGross - dash.month.revenueNet) >= 0.01 ||
      Math.abs(dash.month.costsGross - dash.month.costsNet) >= 0.01
    : false;

  return (
    <PageContainer width="wide">
      {/* Nagłówek */}
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-[12px] text-[#8d8a85] capitalize">{today}</p>
          <h1 className="mt-0.5 text-[22px] sm:text-[26px] font-bold text-[#1f1d1b] leading-tight tracking-tight">
            Witaj, {firstName}
          </h1>
          <p className="mt-1 text-[12px] text-[#6f6c66]">
            {skrzynka.active > 0 ? (
              <span className="font-semibold text-[#1f1d1b]">
                {skrzynka.active} aktywnych zleceń
              </span>
            ) : (
              <span>Brak aktywnych zleceń</span>
            )}
            {skrzynka.overdueCount > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-[#b8523a]">
                  {skrzynka.overdueCount} zaległych
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PrivateModeToggle />
          <UserAvatarMenu
            initial={avatarInitial}
            name={firstName}
            email={user?.email}
            signOutAction={signOut}
          />
        </div>
      </header>

      {/* Logo tylko na telefonie */}
      <div className="flex flex-col items-center gap-1 -mt-1 md:hidden">
        <Image
          src="/brand/logo-luviano.png"
          alt="LUVIANO"
          width={420}
          height={105}
          priority
          className="w-full h-auto max-w-[160px]"
        />
      </div>

      {/* Aktywny timer */}
      {active && activeJob && (
        <ActiveTimerHomeCard
          jobId={active.job_id}
          jobTitle={activeJob.title}
          phaseLabel={WORK_PHASE_LABELS[active.phase]}
          startedAt={active.started_at}
        />
      )}

      {/* Skróty — to, po co najczęściej się wchodzi */}
      <nav aria-label="Skróty" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <QuickAction href="/jobs/new" label="Nowe zlecenie" hint="klient + tytuł" icon={<PlusIcon />} primary />
        <QuickAction href="/timer" label="Licznik czasu" hint="start / stop pracy" icon={<TimerIcon />} />
        <QuickAction href="/calculator" label="Kalkulator" hint="wycena na czysto" icon={<CalcIcon />} />
        <QuickAction href="/cennik-szafek" label="Cennik szafek" hint="stawki i marża" icon={<CabinetIcon />} />
      </nav>

      {/* Główna siatka: zlecenia w toku + terminy */}
      <div className="grid gap-5 xl:[grid-template-columns:minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <SectionHeading action={{ href: "/jobs", label: "Wszystkie zlecenia" }}>
            Zlecenia w toku
          </SectionHeading>
          {shownJobs.length > 0 ? (
            <div className="rounded-2xl border border-[#ededea] bg-white divide-y divide-[#eeeeed] shadow-[0_1px_2px_rgba(40,38,36,0.04)]">
              {shownJobs.map((j) => (
                <JobRow key={j.id} job={j} todayIso={todayIso} overdue={isOverdue(j)} />
              ))}
              {openJobs.length > shownJobs.length && (
                <Link
                  href="/jobs"
                  className="block px-3.5 py-2.5 text-center text-[12px] font-semibold text-[#a06f3f] active:bg-[#f6f6f5] last:rounded-b-2xl"
                >
                  + {openJobs.length - shownJobs.length} kolejnych
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d8d7d3] bg-white/60 px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-[#4a4843]">Brak zleceń w toku</p>
              <p className="text-[12px] text-[#8d8a85] mt-1">
                Nowe zlecenie założysz skrótem powyżej albo ze Skanera na iPadzie.
              </p>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section>
            <SectionHeading>Najbliższe 14 dni</SectionHeading>
            {agenda.length > 0 ? (
              <div className="rounded-2xl border border-[#ededea] bg-white divide-y divide-[#eeeeed] shadow-[0_1px_2px_rgba(40,38,36,0.04)]">
                {agenda.map((a, i) => (
                  <AgendaRow key={`${a.jobId}-${a.kind}-${i}`} item={a} todayIso={todayIso} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#d8d7d3] bg-white/60 px-4 py-5 text-center">
                <p className="text-[13px] font-semibold text-[#4a4843]">Brak terminów w 14 dni</p>
                <p className="text-[12px] text-[#8d8a85] mt-1">
                  Pomiary, montaże i terminy oddania biorą się z dat w zleceniach.
                </p>
              </div>
            )}
          </section>

          {/* Pilne terminy podatkowe */}
          {urgentReminders.length > 0 && (
            <section>
              <SectionHeading action={{ href: "/finanse/terminy", label: "Terminy" }}>
                Pilne — podatki i ZUS
              </SectionHeading>
              <div className="space-y-1.5">
                {urgentReminders.map((r) => (
                  <UrgentRow
                    key={r.kind}
                    label={`${r.label} · ${r.periodLabel}`}
                    deadline={r.deadline}
                    daysUntil={r.daysUntil}
                    amount={r.amount}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Skrót finansów — bez powielania pełnego dashboardu */}
      {dash && (
        <section>
          <SectionHeading action={{ href: "/finanse", label: "Finanse" }}>
            Finanse · {monthName}
          </SectionHeading>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
            <StatCard
              label="Przychód brutto"
              value={fmtPLN(dash.month.revenueGross)}
              hint={showNet ? `netto ${fmtPLN(dash.month.revenueNet)}` : undefined}
              hintMoney
              tone="neutral"
              money
              href="/finanse"
            />
            <StatCard
              label="Koszty brutto"
              value={fmtPLN(dash.month.costsGross)}
              hint={showNet ? `netto ${fmtPLN(dash.month.costsNet)}` : undefined}
              hintMoney
              tone="neutral"
              money
              href="/invoices"
            />
            <StatCard
              label="Zostaje brutto"
              value={fmtPLN(profitGross)}
              hint={showNet ? `netto ${fmtPLN(dash.month.profit)}` : undefined}
              hintMoney
              tone={profitGross >= 0 ? "ok" : "warn"}
              money
              href="/finanse/rentownosc"
            />
            {vatInfo && (
              <div>
                {vatInfo.vatToReclaim > 0 ? (
                  <StatCard
                    label={`VAT do odzyskania · ${vatInfo.label}`}
                    value={fmtPLN(vatInfo.vatToReclaim)}
                    hint={`JPK do ${fmtDate(vatInfo.deadline)}`}
                    tone="ok"
                    money
                    href="/finanse"
                  />
                ) : (
                  <StatCard
                    label={`VAT do zapłaty · ${vatInfo.label}`}
                    value={fmtPLN(vatInfo.vatToPay)}
                    hint={`do ${fmtDate(vatInfo.deadline)}`}
                    tone="accent"
                    money
                    href="/finanse"
                  />
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

// Następny krok dla etapu — podpowiedź, po co wejść w zlecenie.
function nextStep(job: Job): string {
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

function JobRow({
  job,
  todayIso,
  overdue,
}: {
  job: Job & { client_name: string };
  todayIso: string;
  overdue: boolean;
}) {
  const amount = Number(job.amount_gross);
  let dueLabel: string | null = null;
  if (job.due_date) {
    const days = Math.round(
      (new Date(job.due_date + "T00:00:00").getTime() -
        new Date(todayIso + "T00:00:00").getTime()) /
        86_400_000,
    );
    dueLabel = overdue
      ? `${Math.abs(days)} dni po terminie`
      : days === 0
        ? "termin dziś"
        : days > 0 && days <= 14
          ? `termin za ${days} dni`
          : `termin ${fmtDate(job.due_date)}`;
  }
  const step = nextStep(job);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center gap-3 px-3.5 py-3 active:bg-[#f6f6f5] hover:bg-[#faf9f8] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[15px] font-semibold text-[#1f1d1b] leading-tight truncate">
            {job.client_name}
          </p>
          <Badge tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Badge>
        </div>
        <p className="text-[12px] text-[#6f6c66] truncate mt-1">
          {job.title}
          {step && (
            <>
              {" · "}
              <span className="font-semibold text-[#a06f3f]">{step}</span>
            </>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        {amount > 0 && (
          <Money as="p" className="text-[14px] font-semibold tabular-nums text-[#1f1d1b]">
            {fmtPLN(amount)}
          </Money>
        )}
        {dueLabel && (
          <p
            className={`text-[11px] mt-0.5 ${
              overdue ? "font-semibold text-[#b8523a]" : "text-[#8d8a85]"
            }`}
          >
            {dueLabel}
          </p>
        )}
      </div>
      <span className="text-[#c9c7c2] text-sm shrink-0">→</span>
    </Link>
  );
}

function QuickAction({
  href,
  label,
  hint,
  icon,
  primary = false,
}: {
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-[#ededea] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(40,38,36,0.04)] transition-colors hover:border-[#d8d7d3] active:bg-[#f6f6f5]"
    >
      <span
        aria-hidden
        className={`inline-flex w-10 h-10 rounded-xl items-center justify-center shrink-0 ${
          primary ? "bg-[#a06f3f] text-white" : "bg-[#f1e5d2] text-[#a06f3f]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-[#1f1d1b] leading-tight truncate">
          {label}
        </span>
        <span className="block text-[11px] text-[#8d8a85] truncate mt-0.5">{hint}</span>
      </span>
    </Link>
  );
}

const QA_SVG = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
function PlusIcon() {
  return (
    <svg {...QA_SVG} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function TimerIcon() {
  return (
    <svg {...QA_SVG}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </svg>
  );
}
function CalcIcon() {
  return (
    <svg {...QA_SVG}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </svg>
  );
}
function CabinetIcon() {
  return (
    <svg {...QA_SVG}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M12 3v18M9.5 11v2M14.5 11v2" />
    </svg>
  );
}

function UrgentRow({
  label,
  deadline,
  daysUntil,
  amount,
}: {
  label: string;
  deadline: string;
  daysUntil: number;
  amount: number | null;
}) {
  const overdue = daysUntil < 0;
  const cls = overdue
    ? "border-[#ecccc0] bg-[#fdf4f1] text-[#8f3c28]"
    : "border-[#ecd9b0] bg-[#fdf8ec] text-[#8a6a1f]";
  const suffix =
    daysUntil < 0
      ? `${Math.abs(daysUntil)} dni po terminie`
      : daysUntil === 0
        ? "dziś"
        : daysUntil === 1
          ? "jutro"
          : `za ${daysUntil} dni`;
  return (
    <Link
      href="/finanse/terminy"
      className={`block rounded-xl border ${cls} px-3.5 py-2.5 active:opacity-80 transition-opacity`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-semibold leading-tight truncate">{label}</p>
        {amount !== null && (
          <Money className="text-[14px] font-semibold tabular-nums shrink-0">
            {fmtPLN(amount)}
          </Money>
        )}
      </div>
      <p className="text-[11px] opacity-80 mt-0.5">
        do {fmtDate(new Date(deadline + "T00:00:00"))} · {suffix}
      </p>
    </Link>
  );
}

function AgendaRow({
  item,
  todayIso,
}: {
  item: {
    jobId: string;
    title: string;
    clientName: string;
    dateIso: string;
    kind: "measure" | "deadline" | "install";
  };
  todayIso: string;
}) {
  const date = new Date(item.dateIso + "T00:00:00");
  const dayNum = date.getDate();
  const weekday = new Intl.DateTimeFormat("pl-PL", { weekday: "short" }).format(date);

  const daysDiff = Math.round(
    (date.getTime() - new Date(todayIso + "T00:00:00").getTime()) / 86_400_000,
  );
  const whenLabel =
    daysDiff === 0 ? "dziś" : daysDiff === 1 ? "jutro" : `za ${daysDiff} dni`;

  const kindMeta = {
    measure: { label: "Pomiar", box: "bg-[#dde5ef] text-[#5a7898]", icon: <MeasureIcon /> },
    install: { label: "Montaż", box: "bg-[#e3efe5] text-[#4f8a64]", icon: <InstallIcon /> },
    deadline: { label: "Termin", box: "bg-[#f4e0d9] text-[#b8523a]", icon: <DeadlineIcon /> },
  }[item.kind];

  return (
    <Link
      href={`/jobs/${item.jobId}`}
      className="flex items-center gap-3 px-3 py-3 active:bg-[#f6f6f5] hover:bg-[#faf9f8] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
    >
      <div className="text-center shrink-0 w-10">
        <p className="text-[9px] uppercase tracking-wide font-semibold text-[#9ea29c]">{weekday}</p>
        <p className="text-lg font-bold text-[#1f1d1b] tabular-nums leading-none mt-0.5">{dayNum}</p>
      </div>
      <span
        aria-hidden
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${kindMeta.box}`}
      >
        {kindMeta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[#1f1d1b] truncate leading-tight">
          {item.title}
        </p>
        <p className="text-[11px] text-[#6f6c66] truncate mt-0.5">
          {kindMeta.label} · {item.clientName} · {whenLabel}
        </p>
      </div>
      <span className="text-[#c9c7c2] text-sm shrink-0">→</span>
    </Link>
  );
}

function MeasureIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 6H3v12h18z" />
      <path d="M7 6v3M12 6v3M17 6v3" />
    </svg>
  );
}
function InstallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function DeadlineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
