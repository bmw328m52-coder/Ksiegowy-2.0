import Link from "next/link";
import { PageContainer } from "@/components/ui";
import MonthCarousel from "@/components/finance/MonthCarousel";
import { BalanceRows, GrantSwitch, MonthBalance, Row } from "@/components/finance/MonthBalance";
import { getYearDashboards, MONTH_NAMES_PL, type DashboardData } from "@/lib/dao/dashboard";
import { fmtPLN } from "@/lib/format";
import ExportMonthCard from "@/app/invoices/ExportMonthCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Raporty" };

const SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

export default async function RaportyPage({ searchParams }: { searchParams: Promise<{ rok?: string; dotacja?: string }> }) {
  const { rok, dotacja } = await searchParams;
  const without = dotacja === "bez";
  const now = new Date();
  const parsed = Number(rok);
  const year =
    Number.isInteger(parsed) && parsed >= 2020 && parsed <= now.getFullYear() + 1 ? parsed : now.getFullYear();
  const months = await getYearDashboards(year);
  const curIdx = year === now.getFullYear() ? now.getMonth() : year < now.getFullYear() ? 11 : 0;
  const cur = months[curIdx];

  return (
    <PageContainer className="lv-home">
      <header className="lf-hero">
        <p className="lv-eyebrow">Raport miesięczny · brutto</p>
        <h1 className="lf-hero-big ld-year">
          <Link href={`/finanse/raporty?rok=${year - 1}${without ? "&dotacja=bez" : ""}`} aria-label={`Rok ${year - 1}`} className="ld-yarrow">
            ‹
          </Link>
          {year}
          <Link href={`/finanse/raporty?rok=${year + 1}${without ? "&dotacja=bez" : ""}`} aria-label={`Rok ${year + 1}`} className="ld-yarrow">
            ›
          </Link>
        </h1>
        <p className="lf-hero-sub">Przesuń palcem w lewo lub w prawo, żeby zmienić miesiąc.</p>
      </header>

      {cur.ytd.grantCostsGross > 0 && (
        <GrantSwitch base="/finanse/raporty" params={{ rok: String(year) }} without={without} />
      )}

      <section>
        <MonthCarousel
          labels={SHORT}
          initial={curIdx}
          markers={year === now.getFullYear() ? { [now.getMonth()]: "dziś" } : undefined}
        >
          {months.map((d) => (
            <ReportPanel key={d.month_index} d={d} withGrant={!without} />
          ))}
        </MonthCarousel>
      </section>

      <section className="space-y-2">
        <p className="lv-eyebrow">Paczka dokumentów (dla ING / księgowej)</p>
        <ExportMonthCard />
      </section>

      <section className="lv-card ld-box">
        <h2 className="lc-h2">Cały rok {year} (brutto)</h2>
        <div className="mt-3.5">
          <BalanceRows t={cur.ytd} period="year" withGrant={!without} />
        </div>
        <div className="ld-rows" style={{ marginTop: 10 }}>
          <Row label="Zaliczka PIT YTD (z faktur)" value={fmtPLN(cur.ytd.pit)} sub />
        </div>
      </section>
    </PageContainer>
  );
}

function ReportPanel({ d, withGrant }: { d: DashboardData; withGrant: boolean }) {
  const monthName = MONTH_NAMES_PL[d.month_index];
  return (
    <article className="ld-panel" aria-label={`${monthName} ${d.year}`}>
      <div className="ld-panel-head">
        <h2>
          {monthName} {d.year}
        </h2>
      </div>

      <MonthBalance d={d} withGrant={withGrant} />

      <div className="lv-card ld-box">
        <h3 className="ld-h3">Do zapłacenia i w drodze</h3>
        <div className="ld-rows" style={{ marginTop: 14 }}>
          <Row label="Należności (do zapłaty przez klientów)" value={fmtPLN(d.pendingRevenueGross)} />
          <Row label="Zaliczki otwarte" value={fmtPLN(d.openDepositsTotal)} />
          {d.vat &&
            (d.vat.vatToReclaim > 0 ? (
              <Row label={`VAT do odzyskania (${d.vat.label})`} value={fmtPLN(d.vat.vatToReclaim)} tone="gold" />
            ) : (
              <Row label={`VAT do zapłaty (${d.vat.label})`} value={fmtPLN(d.vat.vatToPay)} />
            ))}
          <Row label="Zaliczka PIT (miesiąc)" value={fmtPLN(d.pit.pitMonth)} />
        </div>
        <p className="ld-note">
          PIT, VAT i ZUS liczone tylko z przychodu z faktur. „Bez faktury” to symulacja — poza podatkiem.
        </p>
      </div>
    </article>
  );
}

