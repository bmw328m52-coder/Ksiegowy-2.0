import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";
import { getDashboardData, MONTH_NAMES_PL } from "@/lib/dao/dashboard";
import { listJobs } from "@/lib/dao/jobs";
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
import { PageContainer, SectionHeading, StatCard } from "@/components/ui";

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

  // ── Skrzynka: liczniki z 14-etapowego workflow ─────────────────────────
  const todayIso = new Date().toISOString().slice(0, 10);
  const in7DaysIso = new Date(new Date().getTime() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const CLOSED = new Set(["settled", "archived", "cancelled"]);
  const DONE = new Set(["installed", "settled", "archived"]);
  const REALIZACJA = new Set([
    "accepted",
    "materials_ordered",
    "in_production",
    "ready_to_install",
  ]);
  const WYCENA = new Set(["to_quote", "quote_sent"]);
  const skrzynka = {
    active: jobs.filter((j) => !CLOSED.has(j.status)).length,
    realizacja: jobs.filter((j) => REALIZACJA.has(j.status)).length,
    wycena: jobs.filter((j) => WYCENA.has(j.status)).length,
    overdueCount: jobs.filter(
      (j) =>
        !DONE.has(j.status) &&
        j.status !== "cancelled" &&
        j.due_date !== null &&
        j.due_date < todayIso,
    ).length,
  };

  // ── Agenda dnia — pomiary/montaże/terminy w 7 dni ──────────────────────
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
      j.start_date <= in7DaysIso &&
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
      j.due_date <= in7DaysIso &&
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
  const agenda = agendaItems.slice(0, 5);

  const vatInfo = dash?.vat ?? null;

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

      {/* Główna siatka: Agenda + Skrzynka */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionHeading action={{ href: "/jobs", label: "Wszystkie zlecenia" }}>
            Co dziś
          </SectionHeading>
          {agenda.length > 0 ? (
            <div className="rounded-2xl border border-[#ededea] bg-white divide-y divide-[#eeeeed] shadow-[0_1px_2px_rgba(40,38,36,0.04)]">
              {agenda.map((a, i) => (
                <AgendaRow key={`${a.jobId}-${a.kind}-${i}`} item={a} todayIso={todayIso} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d8d7d3] bg-white/60 px-4 py-8 text-center flex flex-col items-center gap-3">
              <span className="inline-flex w-12 h-12 rounded-2xl items-center justify-center bg-[#dde5ef] text-[#5a7898]" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 11h18" />
                </svg>
              </span>
              <div>
                <p className="text-[14px] font-semibold text-[#4a4843]">Brak terminów w 7 dni</p>
                <p className="text-[12px] text-[#8d8a85] mt-1">
                  Pomiary i montaże ze zleceń pojawią się tutaj
                </p>
              </div>
              <Link
                href="/jobs/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#a06f3f] text-white text-[13px] font-semibold px-3.5 py-1.5 active:opacity-90 hover:bg-[#7d5530] transition-colors"
              >
                <span className="text-[14px] leading-none">+</span>
                Dodaj zlecenie
              </Link>
            </div>
          )}
        </section>

        <section>
          <SectionHeading action={{ href: "/jobs", label: "Zobacz wszystko" }}>
            Skrzynka
          </SectionHeading>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              <StatCard
                label="Aktywne zlecenia"
                value={skrzynka.active}
                hint="wszystkie poza zamkniętymi"
                tone="accent"
                href="/jobs"
                emphasis
              />
            </div>
            <StatCard
              label="W realizacji"
              value={skrzynka.realizacja}
              hint="produkcja i montaż"
              tone="info"
              href="/jobs?f=realizacja"
            />
            <StatCard
              label="Wyceny"
              value={skrzynka.wycena}
              hint="do wyceny / wysłane"
              tone="warn"
              href="/jobs?f=wycena"
            />
            <StatCard
              label="Zaległe"
              value={skrzynka.overdueCount}
              hint="po terminie"
              tone={skrzynka.overdueCount > 0 ? "warn" : "neutral"}
              href="/jobs?f=overdue"
            />
            {dash && (
              <StatCard
                label="Do faktury"
                value={dash.uninvoicedMonth?.count ?? 0}
                hint="ukończone, bez FV"
                tone="ok"
                href="/invoices"
              />
            )}
          </div>
        </section>
      </div>

      {/* Pilne terminy podatkowe */}
      {urgentReminders.length > 0 && (
        <section>
          <SectionHeading action={{ href: "/finanse/terminy", label: "Terminy" }}>
            Pilne
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

      {/* Skrót finansów — bez powielania pełnego dashboardu */}
      {dash && (
        <section>
          <SectionHeading action={{ href: "/finanse", label: "Finanse" }}>
            Finanse · {monthName}
          </SectionHeading>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
            <StatCard
              label="Przychód netto"
              value={fmtPLN(dash.month.revenueNet)}
              tone="neutral"
              money
              href="/finanse"
            />
            <StatCard
              label="Dochód"
              value={fmtPLN(dash.month.profit)}
              tone={dash.month.profit >= 0 ? "ok" : "warn"}
              money
              href="/finanse/rentownosc"
            />
            {vatInfo && (
              <div className="col-span-2 lg:col-span-1">
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
