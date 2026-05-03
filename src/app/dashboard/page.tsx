import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import { getDashboardData, MONTH_NAMES_PL, type ReminderItem } from "@/lib/dao/dashboard";
import { CATEGORY_COLORS } from "@/lib/dao/cost_lines.types";
import { fmtPLN, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const d = await getDashboardData();
  const monthName = MONTH_NAMES_PL[d.month_index];
  const taxFormLabel = d.settings.tax_form === "skala" ? "skala 12%/32%" : "liniowy 19%";

  const vatPeriodLabel = d.settings.is_vat_payer
    ? d.settings.vat_period === "quarterly"
      ? "kwartalny"
      : "miesięczny"
    : "zwolnienie";
  const hasCashAlerts =
    (d.uninvoicedMonth && d.uninvoicedMonth.count > 0) ||
    d.pendingRevenueGross > 0 ||
    d.openDepositsTotal > 0;
  const hasYearData = d.ytd.revenueNet > 0 || d.ytd.costsNet > 0;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-4">
        <PageHeader title="Dashboard" back={{ href: "/" }} />

        <RemindersBanner reminders={d.reminders} />

        <section className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <header className="px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-zinc-700">
              Bilans — {monthName} {d.year}
            </h2>
          </header>

          {d.vat && (
            <BalanceBlock
              title="VAT"
              periodLabel={d.vat.label}
              deadline={d.vat.deadline}
              rows={[
                { label: "VAT należny (sprzedaż)", value: fmtPLN(d.vat.vatDue) },
                { label: "VAT naliczony (koszty)", value: `− ${fmtPLN(d.vat.vatInput)}` },
              ]}
              total={{ label: "Do zapłaty", value: fmtPLN(d.vat.vatToPay) }}
            />
          )}

          <BalanceBlock
            title="PIT"
            periodLabel={`Zaliczka · ${d.pit.monthLabel}`}
            deadline={d.pit.deadline}
            rows={[
              { label: "Dochód miesiąca", value: fmtPLN(d.pit.profitMonth) },
              { label: `Dochód YTD (${taxFormLabel})`, value: fmtPLN(d.pit.profitYtd), sub: true },
              { label: "PIT YTD razem", value: fmtPLN(d.pit.pitYtd), sub: true },
            ]}
            total={{ label: "Zaliczka miesięczna", value: fmtPLN(d.pit.pitMonth) }}
            isLast
          />
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">
            Bieżący miesiąc — {monthName}
          </h2>
          <div className="space-y-2">
            <Row label="Przychód netto" value={fmtPLN(d.month.revenueNet)} />
            <Row label="Koszty netto" value={fmtPLN(d.month.costsNet)} />
            <Divider />
            <Row label="Dochód" value={fmtPLN(d.month.profit)} bold />
          </div>
          {d.costsByCategoryMonth.length > 0 && (
            <div className="pt-3 border-t border-zinc-100 space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Rozkład kosztów
              </p>
              <CategoryBars rows={d.costsByCategoryMonth} />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">Rok {d.year}</h2>
          {!hasYearData ? (
            <p className="text-xs text-zinc-500 py-4 text-center">
              Brak danych w {d.year}. Dodaj zlecenia (status „Opłacone”) i faktury kosztowe.
            </p>
          ) : (
            <>
              <TrendChart data={d.monthlyTrend} highlightMonth={d.month_index} />
              <div className="space-y-2 pt-3 border-t border-zinc-100">
                <Row label="Przychód netto YTD" value={fmtPLN(d.ytd.revenueNet)} />
                <Row label="Koszty netto YTD" value={fmtPLN(d.ytd.costsNet)} />
                <Row label="Dochód YTD" value={fmtPLN(d.ytd.profit)} bold />
                <Row label="Zaliczka PIT YTD" value={fmtPLN(d.ytd.pit)} />
              </div>
            </>
          )}
        </section>

        {hasCashAlerts && (
          <section className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <h2 className="text-sm font-semibold text-zinc-700 px-4 pt-4 pb-2">
              Alerty kasowe
            </h2>
            {d.uninvoicedMonth && d.uninvoicedMonth.count > 0 && (
              <CashAlertRow
                tone="neutral"
                title={`Niefakturowane (${d.uninvoicedMonth.count})`}
                amount={d.uninvoicedMonth.amountGross}
                hint={`Zlecenia ukończone/opłacone w ${monthName} bez wystawionej faktury.`}
              />
            )}
            {d.pendingRevenueGross > 0 && (
              <CashAlertRow
                tone="warn"
                title="Oczekuje na zapłatę"
                amount={d.pendingRevenueGross}
                hint="Zlecenia „Zakończone”, jeszcze nieopłacone."
              />
            )}
            {d.openDepositsTotal > 0 && (
              <CashAlertRow
                tone="info"
                title="Zaliczki — otwarte zlecenia"
                amount={d.openDepositsTotal}
                hint="Otrzymane zaliczki — nie wchodzą jeszcze do przychodu."
              />
            )}
          </section>
        )}

        <p className="text-[11px] text-zinc-400 text-center pt-2">
          Forma: {taxFormLabel} · VAT: {vatPeriodLabel}
          <br />
          Przychód z zleceń opłaconych. Koszty z faktur kosztowych.
        </p>
      </div>
    </main>
  );
}

function CashAlertRow({
  tone,
  title,
  amount,
  hint,
}: {
  tone: "neutral" | "warn" | "info";
  title: string;
  amount: number;
  hint: string;
}) {
  const accent = {
    neutral: "text-zinc-900",
    warn: "text-amber-800",
    info: "text-sky-800",
  }[tone];
  return (
    <div className="px-4 py-3 border-t border-zinc-100 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`text-sm font-medium ${accent}`}>{title}</p>
        <p className={`text-base font-semibold tabular-nums ${accent}`}>
          {fmtPLN(amount)}
        </p>
      </div>
      <p className="text-[11px] text-zinc-500 mt-0.5">{hint}</p>
    </div>
  );
}

function BalanceBlock({
  title,
  periodLabel,
  deadline,
  rows,
  total,
  isLast = false,
}: {
  title: string;
  periodLabel: string;
  deadline: string;
  rows: { label: string; value: string; sub?: boolean }[];
  total: { label: string; value: string };
  isLast?: boolean;
}) {
  return (
    <div className={`px-4 py-3 ${isLast ? "" : "border-b border-zinc-100"}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-zinc-900">{title}</span>
          <span className="text-[11px] text-zinc-500">{periodLabel}</span>
        </div>
        <DeadlinePill deadline={deadline} />
      </div>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className={`text-sm ${r.sub ? "text-zinc-500" : "text-zinc-600"}`}>
              {r.label}
            </span>
            <span className={`text-sm tabular-nums ${r.sub ? "text-zinc-500" : "text-zinc-700"}`}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-zinc-100">
        <span className="text-sm font-medium text-zinc-900">{total.label}</span>
        <span className="text-lg font-semibold tabular-nums text-[#282624]">
          {total.value}
        </span>
      </div>
    </div>
  );
}

function DeadlinePill({ deadline }: { deadline: string }) {
  const d = new Date(deadline + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const overdue = days < 0;
  const urgent = days >= 0 && days <= 7;
  const cls = overdue
    ? "bg-red-50 text-red-700 border-red-200"
    : urgent
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-zinc-50 text-zinc-600 border-zinc-200";
  const suffix = overdue
    ? `${Math.abs(days)} dni po terminie`
    : days === 0
      ? "dziś"
      : days === 1
        ? "jutro"
        : `za ${days} dni`;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls} whitespace-nowrap`}>
      do {fmtDate(d)} · {suffix}
    </span>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-zinc-600">{label}</span>
      <span className={`text-sm tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-zinc-100" />;
}

function RemindersBanner({ reminders }: { reminders: ReminderItem[] }) {
  const visible = reminders
    .filter((r) => r.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  if (visible.length === 0) return null;

  const overdue = visible.filter((r) => r.daysUntil < 0);
  const urgent = visible.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 7);
  const upcoming = visible.filter((r) => r.daysUntil > 7);

  return (
    <div className="space-y-2">
      {overdue.map((r) => (
        <ReminderRow key={r.kind} item={r} tone="overdue" />
      ))}
      {urgent.map((r) => (
        <ReminderRow key={r.kind} item={r} tone="urgent" />
      ))}
      {upcoming.map((r) => (
        <ReminderRow key={r.kind} item={r} tone="upcoming" />
      ))}
    </div>
  );
}

function ReminderRow({
  item,
  tone,
}: {
  item: ReminderItem;
  tone: "overdue" | "urgent" | "upcoming";
}) {
  const tones = {
    overdue: "border-red-200 bg-red-50 text-red-900",
    urgent: "border-amber-200 bg-amber-50 text-amber-900",
    upcoming: "border-zinc-200 bg-white text-zinc-800",
  } as const;
  const days = item.daysUntil;
  const suffix =
    days < 0
      ? `${Math.abs(days)} dni po terminie`
      : days === 0
        ? "dziś"
        : days === 1
          ? "jutro"
          : `za ${days} dni`;
  return (
    <div className={`rounded-xl border ${tones[tone]} px-3 py-2 flex items-center justify-between gap-3`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">
          {item.label} · {item.periodLabel}
        </p>
        <p className="text-[11px] opacity-80">do {fmtDate(new Date(item.deadline + "T00:00:00"))} · {suffix}</p>
      </div>
      {item.amount !== null && (
        <span className="text-sm font-semibold tabular-nums shrink-0">
          {fmtPLN(item.amount)}
        </span>
      )}
    </div>
  );
}

function CategoryBars({
  rows,
}: {
  rows: { category: string; amountNet: number; share: number }[];
}) {
  const max = rows[0]?.amountNet ?? 0;
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const color = CATEGORY_COLORS[r.category] ?? "#71717a";
        const widthPct = max > 0 ? Math.max(2, (r.amountNet / max) * 100) : 0;
        return (
          <li key={r.category} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-zinc-700 capitalize">{r.category}</span>
              <span className="tabular-nums text-zinc-600">
                {fmtPLN(r.amountNet)} <span className="text-zinc-400">· {Math.round(r.share * 100)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
