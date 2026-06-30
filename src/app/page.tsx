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

type TileVariant = "work" | "money" | "tool" | "meta";

const VARIANT_COLOR: Record<TileVariant, string> = {
  work: "#2563eb",
  money: "#16a34a",
  tool: "#f59e0b",
  meta: "#6b6661",
};

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

  // Imię z e-maila — tylko jeśli wygląda jak imię (litery, brak cyfr).
  // Fallback: "Artur" (jednoosobowa działalność, znany użytkownik LUVIANO).
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

  const hasCashAlerts =
    !!dash &&
    ((dash.uninvoicedMonth && dash.uninvoicedMonth.count > 0) ||
      dash.pendingRevenueGross > 0 ||
      dash.openDepositsTotal > 0);

  // Skrzynka workflow — counts from jobs (12-stage enum)
  const todayIso = new Date().toISOString().slice(0, 10);
  const in7DaysIso = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const CLOSED = new Set(["settled", "archived", "cancelled"]);
  const DONE = new Set(["installed", "settled", "archived"]);
  const IN_PRODUCTION = new Set([
    "accepted",
    "materials_ordered",
    "in_production",
    "ready_to_install",
  ]);
  const skrzynka = {
    active: jobs.filter((j) => !CLOSED.has(j.status)).length,
    inProgress: jobs.filter((j) => IN_PRODUCTION.has(j.status)).length,
    upcoming: jobs.filter(
      (j) => j.start_date && j.start_date >= todayIso && j.start_date <= in7DaysIso,
    ).length,
    overdueCount: jobs.filter(
      (j) =>
        !DONE.has(j.status) &&
        j.status !== "cancelled" &&
        j.due_date !== null &&
        j.due_date < todayIso,
    ).length,
  };

  // Agenda dnia — nadchodzące pomiary i terminy w 7 dni (od dziś)
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

  return (
    <main className="flex flex-1 flex-col px-5 py-6 lg:px-8">
      <div className="w-full max-w-md sm:max-w-lg lg:max-w-none xl:max-w-[920px] mx-auto flex flex-col gap-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-2xl font-bold text-[#282624] leading-tight tracking-tight">
              Witaj Prezesie Luviano
            </h1>
            <p className="mt-1 text-xs text-[#6b6661]">
              <span className="capitalize">{today}</span>
              {skrzynka.active > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-[#282624]">
                    {skrzynka.active} aktywnych zleceń
                  </span>
                </>
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
          <UserAvatarMenu
            initial={avatarInitial}
            name={firstName}
            email={user?.email}
            signOutAction={signOut}
          />
        </header>

        <div className="flex flex-col items-center gap-1 py-1 md:hidden">
          <Image
            src="/brand/logo-luviano.png"
            alt="LUVIANO"
            width={420}
            height={108}
            priority
            className="w-full h-auto max-w-[180px]"
          />
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#9ea29c]">
            Manager firmy
          </p>
        </div>

        {active && activeJob && (
          <ActiveTimerHomeCard
            jobId={active.job_id}
            jobTitle={activeJob.title}
            phaseLabel={WORK_PHASE_LABELS[active.phase]}
            startedAt={active.started_at}
          />
        )}

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-5">
          <section className="lg:order-1">
            <div className="flex items-baseline justify-between mb-2 px-1">
              <SectionLabel>Co dziś</SectionLabel>
              <Link
                href="/jobs"
                className="text-[11px] font-semibold text-[#a06f3f] active:opacity-70 hover:underline"
              >
                Kalendarz →
              </Link>
            </div>
            {agenda.length > 0 ? (
              <div className="rounded-2xl border border-[#e8e4dd] bg-white divide-y divide-[#f0ece5] shadow-[0_1px_2px_rgba(40,38,36,0.04)]">
                {agenda.map((a, i) => (
                  <AgendaRow key={`${a.jobId}-${a.kind}-${i}`} item={a} todayIso={todayIso} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#d8d2c8] bg-white/60 px-4 py-7 text-center flex flex-col items-center gap-3">
                <span className="inline-flex w-12 h-12 rounded-2xl items-center justify-center bg-[#dde5ef] text-[#5a7898]" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 11h18" />
                  </svg>
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[#524d48]">
                    Brak terminów w 7 dni
                  </p>
                  <p className="text-[11px] text-[#9c9081] mt-1">
                    Pomiary i montaże ze zleceń pojawią się tutaj
                  </p>
                </div>
                <Link
                  href="/jobs/new"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#a06f3f] text-white text-[12px] font-semibold px-3.5 py-1.5 active:opacity-90 hover:bg-[#7d5530] transition-colors"
                >
                  <span className="text-[14px] leading-none">+</span>
                  Dodaj pomiar
                </Link>
              </div>
            )}
          </section>

          <section className="lg:order-2">
            <div className="flex items-baseline justify-between mb-2 px-1">
              <SectionLabel>Skrzynka</SectionLabel>
              <Link
                href="/jobs"
                className="text-[11px] font-semibold text-[#a06f3f] active:opacity-70 hover:underline"
              >
                Zobacz wszystko →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <WorkflowTile
                href="/jobs"
                label="Aktywne zlecenia"
                value={skrzynka.active}
                hint="wszystkie poza zamkniętymi"
                tone="accent"
                feature
              />
              <WorkflowTile
                href="/jobs?f=production"
                label="W toku"
                value={skrzynka.inProgress}
                hint="aktualnie wykonywane"
                tone="info"
              />
              <WorkflowTile
                href="/jobs"
                label="Nadchodzące"
                value={skrzynka.upcoming}
                hint="start w 7 dni"
                tone="neutral"
              />
              <WorkflowTile
                href="/jobs?f=overdue"
                label="Zaległe"
                value={skrzynka.overdueCount}
                hint="po terminie"
                tone={skrzynka.overdueCount > 0 ? "warn" : "neutral"}
              />
              {dash && (
                <WorkflowTile
                  href="/invoices"
                  label="Do faktury"
                  value={dash.uninvoicedMonth?.count ?? 0}
                  amount={dash.uninvoicedMonth?.amountGross ?? 0}
                  hint="ukończone, bez FV"
                  tone="ok"
                />
              )}
              {dash && (
                <WorkflowTile
                  href="/dashboard"
                  label={`Marża · ${monthName}`}
                  amount={dash.month.profit}
                  hint="dochód miesiąca"
                  tone={dash.month.profit >= 0 ? "ok" : "warn"}
                  gold={dash.month.profit >= 0}
                />
              )}
            </div>
          </section>
        </div>

        <section>
          <SectionLabel>Szybkie narzędzia</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <QuickTool href="/calculator" label="Wycena" name="Kalkulator" icon={<CalcIcon />} />
            <QuickTool href="/usluga" label="Robocizna" name="Stawka /h" icon={<WrenchIcon />} />
          </div>
        </section>

        {urgentReminders.length > 0 && (
          <section className="space-y-1.5">
            <SectionLabel>Pilne</SectionLabel>
            {urgentReminders.map((r) => (
              <UrgentRow
                key={r.kind}
                label={`${r.label} · ${r.periodLabel}`}
                deadline={r.deadline}
                daysUntil={r.daysUntil}
                amount={r.amount}
              />
            ))}
          </section>
        )}

        {dash && (
          <section>
            <div className="flex items-baseline justify-between mb-2 px-1">
              <SectionLabel>Bilans · {monthName}</SectionLabel>
              <Link
                href="/dashboard"
                className="text-[11px] font-semibold text-[#a06f3f] active:opacity-70 hover:underline"
              >
                Pełny dashboard →
              </Link>
            </div>
            {dash.vat && (
              <VatBreakdownCard
                periodLabel={dash.vat.label}
                deadline={dash.vat.deadline}
                vatDue={dash.vat.vatDue}
                vatInput={dash.vat.vatInput}
                vatToPay={dash.vat.vatToPay}
              />
            )}
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <KpiCard
                label="Przychód netto"
                value={fmtPLN(dash.month.revenueNet)}
                tone="neutral"
              />
              <KpiCard
                label="Dochód"
                value={fmtPLN(dash.month.profit)}
                tone={dash.month.profit >= 0 ? "positive" : "negative"}
              />
              <div className="col-span-2">
                <KpiCard
                  label={`PIT · ${dash.pit.monthLabel}`}
                  value={fmtPLN(dash.pit.pitMonth)}
                  sub={`zaliczka do ${fmtDate(dash.pit.deadline)}`}
                  tone="warn"
                />
              </div>
            </div>
          </section>
        )}

        {dash && hasCashAlerts && (
          <section className="space-y-1.5">
            <SectionLabel>Kasa</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dash.uninvoicedMonth && dash.uninvoicedMonth.count > 0 && (
                <CashRow
                  title={`Do zafakturowania (${dash.uninvoicedMonth.count})`}
                  amount={dash.uninvoicedMonth.amountGross}
                  hint="Ukończone, bez faktury"
                  tone="neutral"
                />
              )}
              {dash.pendingRevenueGross > 0 && (
                <CashRow
                  title="Oczekuje na zapłatę"
                  amount={dash.pendingRevenueGross}
                  hint="Wystawione, nieopłacone"
                  tone="warn"
                />
              )}
              {dash.openDepositsTotal > 0 && (
                <CashRow
                  title="Zaliczki w toku"
                  amount={dash.openDepositsTotal}
                  hint="Otrzymane, jeszcze nie przychód"
                  tone="info"
                />
              )}
            </div>
          </section>
        )}

        <Section title="Zlecenia">
          <Tile href="/clients" label="Klienci" hint="Lista i kontakty" variant="work" icon={<UsersIcon />} />
          <Tile href="/jobs" label="Pomiary" hint="Lista i statusy" variant="work" icon={<BriefcaseIcon />} />
          <Tile href="/briefs" label="Briefy" hint="Pomiary i wyceny" variant="work" icon={<ClipboardIcon />} />
          <Tile href="/timer" label="Licznik" hint="Czas pracy" variant="work" icon={<TimerIcon />} />
        </Section>

        <Section title="Finanse">
          <Tile href="/invoices" label="Faktury" hint="OCR + koszty" variant="money" icon={<ReceiptIcon />} />
          <Tile href="/dashboard" label="Dashboard" hint="VAT, PIT, ZUS" variant="money" icon={<ChartIcon />} />
        </Section>

        <Section title="Narzędzia">
          <Tile href="/calculator" label="Kalkulator" hint="Wycena na czysto" variant="tool" icon={<CalcIcon />} />
          <Tile href="/materials" label="Cennik" hint="Materiały i akcesoria" variant="tool" icon={<PackageIcon />} />
          <Tile href="/usluga" label="Stawka usługi" hint="Robocizna /h" variant="tool" icon={<WrenchIcon />} />
          <Tile href="/settings" label="Ustawienia" hint="Forma, VAT, ZUS" variant="meta" icon={<GearIcon />} />
        </Section>
      </div>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-wide font-semibold text-[#9ea29c]">
      {children}
    </p>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "neutral" | "positive" | "negative" | "warn";
}) {
  const valueClass = {
    neutral: "text-[#282624]",
    positive: "text-emerald-700",
    negative: "text-red-700",
    warn: "text-amber-700",
  }[tone];

  return (
    <div className="rounded-2xl border border-[#e8e4dd] bg-white p-3 shadow-[0_1px_2px_rgba(40,38,36,0.04)]">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-[#9ea29c] truncate">
        {label}
      </p>
      <Money
        as="p"
        className={`mt-1 text-base sm:text-lg font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </Money>
      {sub && <p className="text-[10px] text-[#9ea29c] mt-0.5">{sub}</p>}
    </div>
  );
}

function VatBreakdownCard({
  periodLabel,
  deadline,
  vatDue,
  vatInput,
  vatToPay,
}: {
  periodLabel: string;
  deadline: string;
  vatDue: number;
  vatInput: number;
  vatToPay: number;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e4dd] bg-white shadow-[0_1px_2px_rgba(40,38,36,0.04)] overflow-hidden">
      <div className="flex items-baseline justify-between px-3 pt-2.5 pb-1.5">
        <p className="text-[10px] uppercase tracking-wide font-semibold text-[#9ea29c]">
          VAT · {periodLabel}
        </p>
        <p className="text-[10px] text-[#9ea29c]">
          do {fmtDate(deadline)}
        </p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[#f0ece5] border-t border-[#f0ece5]">
        <div className="px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#9ea29c] truncate">
            Należny
          </p>
          <Money as="p" className="mt-0.5 text-sm font-semibold tabular-nums text-[#282624]">
            {fmtPLN(vatDue)}
          </Money>
          <p className="text-[9px] text-[#9ea29c] mt-0.5 truncate">sprzedaż</p>
        </div>
        <div className="px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#9ea29c] truncate">
            Naliczony
          </p>
          <Money as="p" className="mt-0.5 text-sm font-semibold tabular-nums text-[#4f8a64]">
            − {fmtPLN(vatInput)}
          </Money>
          <p className="text-[9px] text-[#9ea29c] mt-0.5 truncate">koszty</p>
        </div>
        <div className="px-2.5 py-2 bg-[#faf5e9]">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#a18653] truncate">
            Do zapłaty
          </p>
          <Money as="p" className="mt-0.5 text-sm font-bold tabular-nums text-[#a18653]">
            {fmtPLN(vatToPay)}
          </Money>
          <p className="text-[9px] text-[#a18653]/70 mt-0.5 truncate">do US</p>
        </div>
      </div>
    </div>
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
    ? "border-red-200 bg-red-50 text-red-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
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
      href="/dashboard"
      className={`block rounded-xl border ${cls} px-3 py-2 active:opacity-80`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold leading-tight truncate">{label}</p>
        {amount !== null && (
          <Money className="text-sm font-semibold tabular-nums shrink-0">
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

function CashRow({
  title,
  amount,
  hint,
  tone,
}: {
  title: string;
  amount: number;
  hint: string;
  tone: "neutral" | "warn" | "info";
}) {
  const accent = {
    neutral: "text-zinc-900",
    warn: "text-amber-800",
    info: "text-sky-800",
  }[tone];
  return (
    <div className="rounded-xl border border-[#e8e4dd] bg-white px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-sm font-medium ${accent} truncate`}>{title}</p>
        <Money
          as="p"
          className={`text-sm font-semibold tabular-nums ${accent} shrink-0`}
        >
          {fmtPLN(amount)}
        </Money>
      </div>
      <p className="text-[10px] text-[#9ea29c] mt-0.5">{hint}</p>
    </div>
  );
}

function WorkflowTile({
  href,
  label,
  value,
  amount,
  hint,
  tone,
  feature,
  gold,
}: {
  href: string;
  label: string;
  value?: number;
  amount?: number;
  hint: string;
  tone: "accent" | "info" | "neutral" | "warn" | "ok";
  feature?: boolean;
  gold?: boolean;
}) {
  const toneClass = gold
    ? "text-[#a06f3f]"
    : {
        accent: "text-[#282624]",
        info: "text-[#5a7898]",
        neutral: "text-[#524d48]",
        warn: "text-[#b8523a]",
        ok: "text-[#4f8a64]",
      }[tone];

  const toneAccentBar = {
    accent: "bg-[#a06f3f]",
    info: "bg-[#5a7898]",
    neutral: "bg-[#c4bbac]",
    warn: "bg-[#b8523a]",
    ok: "bg-[#4f8a64]",
  }[tone];

  const showValue = typeof value === "number";
  const showAmount = typeof amount === "number";

  const wrapperBase = "relative overflow-hidden rounded-2xl border active:bg-[#faf7f2] transition-colors";
  const wrapperClass = gold
    ? `${wrapperBase} border-[#e2c79c] p-3 shadow-[0_2px_8px_rgba(160,111,63,0.10)] hover:border-[#a06f3f]`
    : feature
      ? `${wrapperBase} col-span-2 border-[#d8d2c8] p-4 shadow-[0_2px_8px_rgba(40,38,36,0.06)] hover:border-[#c4bbac]`
      : `${wrapperBase} border-[#e8e4dd] bg-white p-3 shadow-[0_1px_2px_rgba(40,38,36,0.04)] hover:border-[#d8d2c8]`;
  const wrapperStyle = gold
    ? { background: "linear-gradient(160deg, #fbf1dd 0%, #fff8e9 100%)" }
    : feature
      ? { background: "linear-gradient(160deg, #efece5 0%, #faf7f2 100%)" }
      : undefined;

  const valueSize = feature
    ? "text-[32px] leading-none"
    : "text-[24px] leading-none";
  const amountSize = feature ? "text-base" : "text-sm";
  const labelSize = feature ? "text-[11px]" : "text-[10px]";
  const hintSize = feature ? "text-[11px]" : "text-[10px]";

  return (
    <Link href={href} className={wrapperClass} style={wrapperStyle}>
      <span aria-hidden className={`absolute top-0 left-0 right-0 h-[3px] ${toneAccentBar}`} />
      <p className={`${labelSize} uppercase tracking-wide font-semibold text-[#9ea29c] truncate`}>
        {label}
      </p>
      <div className={`${feature ? "mt-1.5" : "mt-1"} flex items-baseline gap-2`}>
        {showValue && (
          <span className={`${valueSize} font-bold tabular-nums ${toneClass}`}>
            {value}
          </span>
        )}
        {showAmount && (
          <Money
            className={`${amountSize} font-semibold tabular-nums ${toneClass} ${showValue ? "opacity-80" : ""}`}
          >
            {fmtPLN(amount as number)}
          </Money>
        )}
      </div>
      <p className={`${hintSize} text-[#9ea29c] ${feature ? "mt-1" : "mt-0.5"} truncate`}>{hint}</p>
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
    measure: {
      label: "Pomiar",
      box: "bg-[#dde5ef] text-[#5a7898]",
      icon: <MeasureIcon />,
    },
    install: {
      label: "Montaż",
      box: "bg-[#e3efe5] text-[#4f8a64]",
      icon: <InstallIcon />,
    },
    deadline: {
      label: "Termin",
      box: "bg-[#f4e0d9] text-[#b8523a]",
      icon: <DeadlineIcon />,
    },
  }[item.kind];

  return (
    <Link
      href={`/jobs/${item.jobId}`}
      className="flex items-center gap-3 px-3 py-3 active:bg-[#faf7f2]"
    >
      <div className="text-center shrink-0 w-10">
        <p className="text-[9px] uppercase tracking-wide font-semibold text-[#9ea29c]">
          {weekday}
        </p>
        <p className="text-lg font-bold text-[#282624] tabular-nums leading-none mt-0.5">
          {dayNum}
        </p>
      </div>
      <span
        aria-hidden
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${kindMeta.box}`}
      >
        {kindMeta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[#282624] truncate leading-tight">
          {item.title}
        </p>
        <p className="text-[11px] text-[#6b6661] truncate mt-0.5">
          {kindMeta.label} · {item.clientName} · {whenLabel}
        </p>
      </div>
      <span className="text-[#c4bbac] text-sm shrink-0">→</span>
    </Link>
  );
}

function MeasureIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 6H3v12h18z" />
      <path d="M7 6v3" />
      <path d="M12 6v3" />
      <path d="M17 6v3" />
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

function QuickTool({
  href,
  label,
  name,
  icon,
}: {
  href: string;
  label: string;
  name: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-[#e8e4dd] bg-white px-3 py-2.5 active:bg-[#faf7f2] hover:border-[#a06f3f] transition-colors shadow-[0_1px_2px_rgba(40,38,36,0.04)]"
    >
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#f1e5d2] text-[#a06f3f] shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-[#9c9081]">{label}</span>
        <span className="text-[13px] font-semibold text-[#282624] truncate">{name}</span>
      </span>
    </Link>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-[11px] uppercase tracking-wide font-semibold text-[#9ea29c] mb-2 ml-1">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2.5">{children}</div>
    </section>
  );
}

function Tile({
  href,
  label,
  hint,
  variant,
  icon,
}: {
  href: string;
  label: string;
  hint: string;
  variant: TileVariant;
  icon: React.ReactNode;
}) {
  const color = VARIANT_COLOR[variant];
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#e8e4dd] bg-white p-3.5 flex items-center gap-3 transition-all active:scale-[0.98] active:bg-[#faf7f2] shadow-[0_1px_2px_rgba(40,38,36,0.04)] hover:shadow-[0_2px_8px_rgba(40,38,36,0.08)] hover:border-[#d8d2c8]"
    >
      <span
        className="inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
        style={{ background: `${color}14`, color }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex flex-col">
        <span className="text-sm font-semibold tracking-tight text-[#282624] truncate">
          {label}
        </span>
        <span className="text-[11px] text-[#6b6661] truncate">{hint}</span>
      </span>
    </Link>
  );
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function UsersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2H4z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

function CalcIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
      <path d="M8 16h.01" />
      <path d="M12 16h.01" />
      <path d="M16 16h.01" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg {...iconProps}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5z" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 2h6" />
      <path d="M12 2v3" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.27 6.96 8.73 5.05 8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.07A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
