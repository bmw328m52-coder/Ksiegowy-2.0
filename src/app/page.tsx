import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";
import { getDashboardData, MONTH_NAMES_PL } from "@/lib/dao/dashboard";
import { listJobs } from "@/lib/dao/jobs";
import type { Job } from "@/lib/dao/jobs.types";
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
import SearchBox from "@/components/SearchBox";
import ProjectCard from "@/components/job/ProjectCard";
import { PageContainer, SectionHeading, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Awaria odczytu nie może wyglądać jak „brak danych” — pokazujemy ostrzeżenie zamiast pustych liczb.
  const [dashRes, active, jobsRes] = await Promise.all([
    getDashboardData().then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: null }),
    ),
    getActiveTimer().catch(() => null),
    listJobs().then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: [] as Awaited<ReturnType<typeof listJobs>> }),
    ),
  ]);
  const dash = dashRes.value;
  const jobs = jobsRes.value;
  const loadFailed = !dashRes.ok || !jobsRes.ok;
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

  const isOverdue = (j: Job) =>
    !DONE.has(j.status) && j.due_date !== null && j.due_date < todayIso;

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

  const recentJobs = [...jobs]
    .filter((j) => !CLOSED.has(j.status))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 8);
  const hour = new Date().getHours();
  const hello = hour < 18 ? "Cześć" : "Dobry wieczór";

  return (
    <PageContainer width="wide" className="premium-home lv-home">
      {/* Hero */}
      <header className="lv-hero">
        <div className="min-w-0">
          <p className="lv-eyebrow">{today}</p>
          <h1 className="lv-hello">
            {hello}, {firstName}!
            <span>Co robimy dziś?</span>
          </h1>
          <p className="lv-hero-sub">
            {loadFailed ? (
              <b className="lv-warn">Nie udało się wczytać zleceń</b>
            ) : skrzynka.active > 0 ? (
              <>
                <b>{skrzynka.active}</b> aktywnych zleceń
              </>
            ) : (
              "Brak aktywnych zleceń"
            )}
            {skrzynka.overdueCount > 0 && (
              <>
                {" · "}
                <b className="lv-warn">{skrzynka.overdueCount} po terminie</b>
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

      {loadFailed && (
        <p role="alert" className="lv-alert">
          Nie udało się wczytać danych z bazy, więc to, co widzisz poniżej, może być niepełne. Odśwież stronę za chwilę.
        </p>
      )}

      <div className="md:hidden flex justify-center">
        <Image
          src="/brand/logo-luviano.png"
          alt="LUVIANO"
          width={420}
          height={105}
          priority
          className="w-full h-auto max-w-[150px]"
        />
      </div>

      <SearchBox />

      {active && activeJob && (
        <ActiveTimerHomeCard
          jobId={active.job_id}
          jobTitle={activeJob.title}
          phaseLabel={WORK_PHASE_LABELS[active.phase]}
          startedAt={active.started_at}
        />
      )}

      {/* Cztery główne akcje */}
      <nav aria-label="Główne akcje" className="lv-tiles">
        <ActionTile href="/briefs/new" title="Nowy pomiar" hint="Skan LiDAR · rzut · wymiary" icon={<ScanIcon />} featured />
        <ActionTile href="/calculator" title="Wycena" hint="Kuchnia · szafa · kwota na rękę" icon={<CalcIcon />} />
        <ActionTile href="/jobs" title="Projekt mebli" hint="PRO100 · szkice · poprawki" icon={<CabinetIcon />} />
        <ActionTile href="/jobs?v=klienci" title="Baza klientów" hint="Kontakty i historia zleceń" icon={<UsersIcon />} />
      </nav>
      <div className="lv-minor">
        <Link href="/jobs/new">+ Nowe zlecenie</Link>
        <Link href="/clients/new">+ Klient</Link>
        <Link href="/timer">Licznik czasu</Link>
      </div>

      {/* Ostatnie projekty — poziome karty */}
      <section>
        <SectionHeading action={{ href: "/jobs", label: "Wszystkie zlecenia" }}>
          Ostatnie projekty
        </SectionHeading>
        {recentJobs.length > 0 ? (
          <div className="lv-rail" role="list">
            {recentJobs.map((j) => (
              <ProjectCard key={j.id} job={j} todayIso={todayIso} overdue={isOverdue(j)} />
            ))}
          </div>
        ) : (
          <div className="lv-empty">
            <p>Brak zleceń w toku</p>
            <span>Zacznij od „Nowy pomiar” albo „Wycena”.</span>
          </div>
        )}
      </section>

      <div className="lv-cols">
        <section>
          <SectionHeading>Najbliższe 14 dni</SectionHeading>
          {agenda.length > 0 ? (
            <div className="lv-card lv-list">
              {agenda.map((a, i) => (
                <AgendaRow key={`${a.jobId}-${a.kind}-${i}`} item={a} todayIso={todayIso} />
              ))}
            </div>
          ) : (
            <div className="lv-empty">
              <p>Brak terminów w 14 dni</p>
              <span>Pomiary, montaże i terminy biorą się z dat w zleceniach.</span>
            </div>
          )}
        </section>

        {urgentReminders.length > 0 && (
          <section>
            <SectionHeading action={{ href: "/finanse/terminy", label: "Terminy" }}>
              Pilne — podatki i ZUS
            </SectionHeading>
            <div className="space-y-2">
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
            {vatInfo &&
              (vatInfo.vatToReclaim > 0 ? (
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
              ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

function ActionTile({
  href,
  title,
  hint,
  icon,
  featured = false,
}: {
  href: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <Link href={href} data-featured={featured} className="lv-tile">
      <span aria-hidden className="lv-tile-ico">{icon}</span>
      <span className="lv-tile-txt">
        <b>{title}</b>
        <small>{hint}</small>
      </span>
      <span aria-hidden className="lv-tile-go">→</span>
    </Link>
  );
}

const SVG = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
function ScanIcon() {
  return (
    <svg {...SVG}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M12 8l4 2.2v4.6L12 17l-4-2.2v-4.6zM8 10.2l4 2.3 4-2.3M12 12.5V17" />
    </svg>
  );
}
function CalcIcon() {
  return (
    <svg {...SVG}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </svg>
  );
}
function CabinetIcon() {
  return (
    <svg {...SVG}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M12 3v18M9.5 11v2M14.5 11v2" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg {...SVG}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c1.8.8 3 2.6 3 4.6" />
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
  const suffix =
    daysUntil < 0
      ? `${Math.abs(daysUntil)} dni po terminie`
      : daysUntil === 0
        ? "dziś"
        : daysUntil === 1
          ? "jutro"
          : `za ${daysUntil} dni`;
  return (
    <Link href="/finanse/terminy" className="lv-urgent" data-late={overdue}>
      <div className="flex items-baseline justify-between gap-3">
        <p>{label}</p>
        {amount !== null && <Money className="tabular-nums shrink-0 font-semibold">{fmtPLN(amount)}</Money>}
      </div>
      <small>
        do {fmtDate(new Date(deadline + "T00:00:00"))} · {suffix}
      </small>
    </Link>
  );
}

function AgendaRow({
  item,
  todayIso,
}: {
  item: { jobId: string; title: string; clientName: string; dateIso: string; kind: "measure" | "deadline" | "install" };
  todayIso: string;
}) {
  const date = new Date(item.dateIso + "T00:00:00");
  const weekday = new Intl.DateTimeFormat("pl-PL", { weekday: "short" }).format(date);
  const daysDiff = Math.round((date.getTime() - new Date(todayIso + "T00:00:00").getTime()) / 86_400_000);
  const whenLabel = daysDiff === 0 ? "dziś" : daysDiff === 1 ? "jutro" : `za ${daysDiff} dni`;
  const kindMeta = {
    measure: { label: "Pomiar", icon: <MeasureIcon /> },
    install: { label: "Montaż", icon: <InstallIcon /> },
    deadline: { label: "Termin", icon: <DeadlineIcon /> },
  }[item.kind];
  return (
    <Link href={`/jobs/${item.jobId}`} className="lv-agenda" data-kind={item.kind}>
      <div className="lv-agenda-day">
        <small>{weekday}</small>
        <b>{date.getDate()}</b>
      </div>
      <span aria-hidden className="lv-agenda-ico">{kindMeta.icon}</span>
      <div className="min-w-0 flex-1">
        <p>{item.title}</p>
        <small>
          {kindMeta.label} · {item.clientName} · {whenLabel}
        </small>
      </div>
      <span aria-hidden className="lv-tile-go">→</span>
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

