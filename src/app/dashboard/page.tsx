import Link from "next/link";
import { PageContainer } from "@/components/ui";
import MonthCarousel from "@/components/finance/MonthCarousel";
import { FinTrendChart } from "../finanse/fin-ui";
import { Money } from "@/components/Money";
import { getYearDashboards, MONTH_NAMES_PL, type DashboardData } from "@/lib/dao/dashboard";
import { BalanceRows, GrantSwitch, MonthBalance, Row } from "@/components/finance/MonthBalance";
import { fmtPLN, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Podatki i ZUS" };

const SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function daysFromToday(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
}

function whenLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} dni po terminie`;
  if (days === 0) return "dziś";
  if (days === 1) return "jutro";
  return `za ${days} dni`;
}

export default async function TaxPage({ searchParams }: { searchParams: Promise<{ rok?: string; dotacja?: string }> }) {
  const { rok, dotacja } = await searchParams;
  const without = dotacja === "bez";
  const now = new Date();
  const parsed = Number(rok);
  const year = Number.isInteger(parsed) && parsed >= 2020 && parsed <= now.getFullYear() + 1 ? parsed : now.getFullYear();
  const months = await getYearDashboards(year);
  const curIdx = year === now.getFullYear() ? now.getMonth() : year < now.getFullYear() ? 11 : 0;
  const cur = months[curIdx];
  const s = cur.settings;
  const taxFormLabel = s.tax_form === "skala" ? "skala 12% / 32%" : "liniowy 19%";
  const vatLabel = s.is_vat_payer ? (s.vat_period === "quarterly" ? "VAT kwartalny" : "VAT miesięczny") : "zwolnienie z VAT";

  // Najbliższe terminy: obowiązki za poprzedni i bieżący miesiąc (płatne w przyszłym), bez duplikatów.
  const upcoming: { key: string; label: string; period: string; deadline: string; days: number; amount: number | null }[] = [];
  const seen = new Set<string>();
  if (year === now.getFullYear()) {
    for (const mi of [Math.max(0, curIdx - 1), curIdx]) {
      for (const r of months[mi].reminders) {
        const k = `${r.kind}-${r.deadline}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const days = daysFromToday(r.deadline);
        if (days < 0) continue;
        upcoming.push({ key: k, label: r.label, period: r.periodLabel, deadline: r.deadline, days, amount: r.amount });
      }
    }
    upcoming.sort((a, b) => a.days - b.days);
  }

  const hasYearData = cur.ytd.revenueGross > 0 || cur.ytd.costsGross > 0;
  const hasCashAlerts =
    (cur.uninvoicedMonth && cur.uninvoicedMonth.count > 0) || cur.pendingRevenueGross > 0 || cur.openDepositsTotal > 0;

  return (
    <PageContainer className="lv-home">
      <header className="lf-hero">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="lv-eyebrow">Podatki i ZUS</p>
            <h1 className="lf-hero-big ld-year">
              <Link href={`/dashboard?rok=${year - 1}${without ? "&dotacja=bez" : ""}`} aria-label={`Rok ${year - 1}`} className="ld-yarrow">
                ‹
              </Link>
              {year}
              <Link href={`/dashboard?rok=${year + 1}${without ? "&dotacja=bez" : ""}`} aria-label={`Rok ${year + 1}`} className="ld-yarrow">
                ›
              </Link>
            </h1>
            <p className="lf-hero-sub">
              {taxFormLabel} · {vatLabel}
            </p>
          </div>
        </div>
        {upcoming.length > 0 && (
          <div className="ld-due">
            {upcoming.slice(0, 4).map((u) => (
              <div key={u.key} data-urgent={u.days <= 7}>
                <small>
                  {u.label} · {u.period}
                </small>
                <b>{u.amount !== null ? <Money>{fmtPLN(u.amount)}</Money> : "—"}</b>
                <span>
                  do {fmtDate(new Date(u.deadline + "T00:00:00"))} · {whenLabel(u.days)}
                </span>
              </div>
            ))}
          </div>
        )}
      </header>

      {cur.ytd.grantCostsGross > 0 && (
        <GrantSwitch base="/dashboard" params={{ rok: String(year) }} without={without} />
      )}

      <section>
        <p className="ld-hint">Przesuń palcem w lewo lub w prawo, żeby zobaczyć kolejne miesiące.</p>
        <MonthCarousel
          labels={SHORT}
          initial={curIdx}
          markers={year === now.getFullYear() ? { [now.getMonth()]: "dziś" } : undefined}
        >
          {months.map((d) => (
            <MonthPanel key={d.month_index} d={d} withGrant={!without} isCurrent={year === now.getFullYear() && d.month_index === now.getMonth()} />
          ))}
        </MonthCarousel>
      </section>

      <section className="lv-card ld-box">
        <h2 className="lc-h2">Cały rok {year}</h2>
        {!hasYearData ? (
          <p className="ld-empty">Brak danych w {year}. Dodaj zlecenia z fakturą i faktury kosztowe.</p>
        ) : (
          <>
            <FinTrendChart data={cur.monthlyTrend} highlightMonth={year === now.getFullYear() ? now.getMonth() : undefined} />
            <div className="mt-3.5">
              <BalanceRows t={cur.ytd} period="year" withGrant={!without} />
            </div>
            <div className="ld-rows" style={{ marginTop: 10 }}>
              <Row label="Zaliczki PIT razem (z faktur)" value={fmtPLN(cur.ytd.pit)} sub />
            </div>
          </>
        )}
      </section>

      {hasCashAlerts && (
        <section className="lv-card lv-list">
          <h2 className="lc-h2 ld-pad">Pieniądze w drodze</h2>
          {cur.uninvoicedMonth && cur.uninvoicedMonth.count > 0 && (
            <CashRow
              title={`Bez faktury (${cur.uninvoicedMonth.count})`}
              amount={cur.uninvoicedMonth.amountGross}
              hint={`Zlecenia z ${MONTH_NAMES_PL[curIdx].toLowerCase()} bez wystawionej faktury.`}
            />
          )}
          {cur.pendingRevenueGross > 0 && (
            <CashRow title="Czeka na zapłatę" amount={cur.pendingRevenueGross} hint="Zamontowane, jeszcze nieopłacone." />
          )}
          {cur.openDepositsTotal > 0 && (
            <CashRow title="Zaliczki w otwartych zleceniach" amount={cur.openDepositsTotal} hint="Nie wchodzą jeszcze do przychodu." />
          )}
        </section>
      )}

      <p className="ld-foot">
        PIT, ZUS i VAT liczymy tylko ze zleceń z fakturą. Zlecenia bez faktury są symulacją: widać je w przychodzie
        i rentowności, ale poza podatkiem. Terminy każdego miesiąca dotyczą płatności w miesiącu następnym.
      </p>
    </PageContainer>
  );
}

function MonthPanel({ d, isCurrent, withGrant }: { d: DashboardData; isCurrent: boolean; withGrant: boolean }) {
  const monthName = MONTH_NAMES_PL[d.month_index];
  const empty = d.month.revenueGross === 0 && d.month.costsGross === 0;
  const quarterly = d.settings.vat_period === "quarterly";
  const quarterEnd = d.month_index % 3 === 2;
  const vatSettledHere = !quarterly || quarterEnd;
  const vatAmount = d.vat ? d.vat.vatToPay : 0;
  const pitAmount = d.pit.pitMonth;
  const zusAmount = d.zus?.total ?? d.reminders.find((r) => r.kind === "zus")?.amount ?? 0;
  const total = (vatSettledHere ? vatAmount : 0) + pitAmount + zusAmount;
  const taxFormLabel = d.settings.tax_form === "skala" ? "skala" : "liniowy";

  return (
    <article className="ld-panel" aria-label={`${monthName} ${d.year}`}>
      <div className="ld-panel-head">
        <h2>
          {monthName} {d.year}
        </h2>
        {isCurrent && <span className="ld-tag">bieżący miesiąc</span>}
        {empty && !isCurrent && <span className="ld-tag" data-muted="true">brak danych</span>}
      </div>

      <div className="ld-total">
        <small>Do zapłaty za {monthName.toLowerCase()}</small>
        <b>
          <Money>{fmtPLN(total)}</Money>
        </b>
        <span>VAT + PIT + ZUS, płatne w następnym miesiącu</span>
      </div>

      <div className="ld-taxes">
        {d.vat && (
          <TaxCard
            title="VAT"
            sub={d.vat.label}
            amount={vatSettledHere ? (d.vat.vatToReclaim > 0 ? d.vat.vatToReclaim : vatAmount) : null}
            amountNote={vatSettledHere ? (d.vat.vatToReclaim > 0 ? "do odzyskania" : "do zapłaty") : undefined}
            tone={vatSettledHere && d.vat.vatToReclaim > 0 ? "ok" : undefined}
            deadline={d.vat.deadline}
            rows={[
              { label: "VAT należny (sprzedaż)", value: fmtPLN(d.vat.vatDue) },
              { label: "VAT naliczony (koszty)", value: `− ${fmtPLN(d.vat.vatInput)}` },
              ...(d.vat.vatGrantInput > 0
                ? [{ label: "w tym z dotacji (do zwrotu do PUP)", value: fmtPLN(d.vat.vatGrantInput), sub: true }]
                : []),
            ]}
            note={!vatSettledHere ? `VAT kwartalny: ${d.vat.label} rozliczysz po zamknięciu kwartału.` : undefined}
          />
        )}
        <TaxCard
          title="PIT"
          sub={`zaliczka · ${taxFormLabel}`}
          amount={pitAmount}
          deadline={d.pit.deadline}
          rows={[
            { label: "Dochód miesiąca (z faktur)", value: fmtPLN(d.pit.profitMonth) },
            { label: "Dochód od początku roku", value: fmtPLN(d.pit.profitYtd), sub: true },
            { label: "PIT narastająco", value: fmtPLN(d.pit.pitYtd), sub: true },
          ]}
        />
        <TaxCard
          title="ZUS"
          sub={d.zus ? d.zus.phaseLabel : "składka"}
          amount={zusAmount}
          deadline={d.zus?.deadline ?? d.reminders.find((r) => r.kind === "zus")?.deadline ?? d.pit.deadline}
          rows={
            d.zus
              ? [
                  { label: "Społeczne", value: fmtPLN(d.zus.social) },
                  { label: "Zdrowotna", value: fmtPLN(d.zus.health) },
                ]
              : []
          }
          note={!d.zus ? "Ustaw datę startu działalności w Ustawieniach, a policzę składki dokładnie." : undefined}
        />
      </div>

      <MonthBalance d={d} withGrant={withGrant} />
    </article>
  );
}

function TaxCard({
  title,
  sub,
  amount,
  amountNote,
  tone,
  deadline,
  rows,
  note,
}: {
  title: string;
  sub: string;
  amount: number | null;
  amountNote?: string;
  tone?: "ok";
  deadline: string;
  rows: { label: string; value: string; sub?: boolean }[];
  note?: string;
}) {
  const days = daysFromToday(deadline);
  const urgent = days >= 0 && days <= 7;
  const overdue = days < 0;
  return (
    <section className="ld-tax" data-tone={tone}>
      <div className="ld-tax-top">
        <div>
          <h3>{title}</h3>
          <small>{sub}</small>
        </div>
        <span className="ld-pill" data-s={overdue ? "late" : urgent ? "urgent" : "ok"}>
          do {fmtDate(new Date(deadline + "T00:00:00"))} · {whenLabel(days)}
        </span>
      </div>
      <p className="ld-tax-amount">
        {amount === null ? <span className="ld-dash">—</span> : <Money>{fmtPLN(amount)}</Money>}
        {amountNote && <small>{amountNote}</small>}
      </p>
      {rows.length > 0 && (
        <div className="ld-rows">
          {rows.map((r, i) => (
            <Row key={i} label={r.label} value={r.value} sub={r.sub} />
          ))}
        </div>
      )}
      {note && <p className="ld-note">{note}</p>}
    </section>
  );
}

function CashRow({ title, amount, hint }: { title: string; amount: number; hint: string }) {
  return (
    <div className="ld-cash">
      <div className="flex items-baseline justify-between gap-3">
        <p>{title}</p>
        <Money className="tabular-nums font-semibold">{fmtPLN(amount)}</Money>
      </div>
      <small>{hint}</small>
    </div>
  );
}
