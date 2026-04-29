import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import { getDashboardData, MONTH_NAMES_PL } from "@/lib/dao/dashboard";
import { fmtPLN, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const d = await getDashboardData();
  const monthName = MONTH_NAMES_PL[d.month_index];
  const taxFormLabel = d.settings.tax_form === "skala" ? "skala 12%/32%" : "liniowy 19%";

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-4">
        <PageHeader title="Dashboard" back={{ href: "/" }} />

        <p className="text-xs text-zinc-500">
          Forma: {taxFormLabel} · VAT: {d.settings.is_vat_payer ? d.settings.vat_period === "quarterly" ? "kwartalny" : "miesięczny" : "zwolnienie"}
        </p>

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

        <section className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-600">{monthName} {d.year} — sprzedaż i koszty</h2>
          <Row label="Przychód netto" value={fmtPLN(d.month.revenueNet)} />
          <Row label="Koszty netto" value={fmtPLN(d.month.costsNet)} />
          <Divider />
          <Row label="Dochód" value={fmtPLN(d.month.profit)} bold />
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-600">Trend miesięczny — {d.year}</h2>
          {d.ytd.revenueNet === 0 && d.ytd.costsNet === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">
              Brak danych w {d.year}. Dodaj zlecenia (status „Opłacone”) i faktury kosztowe, aby zobaczyć trend.
            </p>
          ) : (
            <TrendChart data={d.monthlyTrend} highlightMonth={d.month_index} />
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-600">Rok {d.year} (YTD)</h2>
          <Row label="Przychód netto" value={fmtPLN(d.ytd.revenueNet)} />
          <Row label="Koszty netto" value={fmtPLN(d.ytd.costsNet)} />
          <Divider />
          <Row label="Dochód" value={fmtPLN(d.ytd.profit)} bold />
          <Row label="Zaliczka PIT" value={fmtPLN(d.ytd.pit)} />
        </section>

        {d.uninvoicedMonth && d.uninvoicedMonth.count > 0 && (
          <section className="rounded-xl border border-zinc-300 bg-white p-4">
            <p className="text-sm font-medium text-zinc-900">
              Niefakturowane w {monthName} ({d.uninvoicedMonth.count})
            </p>
            <div className="mt-2 space-y-1">
              <Row label="Brutto" value={fmtPLN(d.uninvoicedMonth.amountGross)} />
              {d.settings.is_vat_payer && (
                <>
                  <Row label="Netto" value={fmtPLN(d.uninvoicedMonth.amountNet)} />
                  <Row label="VAT (gdy zafakturujesz)" value={fmtPLN(d.uninvoicedMonth.amountVat)} />
                </>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Zlecenia ukończone/opłacone w tym miesiącu bez wystawionej faktury.
            </p>
          </section>
        )}

        {d.pendingRevenueGross > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">Oczekuje na zapłatę</p>
            <p className="text-lg font-semibold text-amber-900 mt-1">
              {fmtPLN(d.pendingRevenueGross)}
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Zlecenia ze statusem „Zakończone”, jeszcze nieopłacone.
            </p>
          </section>
        )}

        {d.openDepositsTotal > 0 && (
          <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-medium text-sky-900">Zaliczki — otwarte zlecenia</p>
            <p className="text-lg font-semibold text-sky-900 mt-1">
              {fmtPLN(d.openDepositsTotal)}
            </p>
            <p className="text-xs text-sky-800 mt-1">
              Zaliczki otrzymane na zlecenia jeszcze niezakończone — nie wchodzą do przychodu.
            </p>
          </section>
        )}

        <p className="text-xs text-zinc-400 text-center pt-2">
          Przychód liczony z zleceń opłaconych (data zapłaty). Koszty z faktur kosztowych.
        </p>
      </div>
    </main>
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
