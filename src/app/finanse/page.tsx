import Link from "next/link";
import type { Metadata } from "next";
import { getFinanceAttention, getMonthEstimatedCost } from "@/lib/dao/finance";
import { getDashboardData, MONTH_NAMES_PL } from "@/lib/dao/dashboard";
import { fmtPLN } from "@/lib/format";
import { Money } from "@/components/Money";
import PrivateModeToggle from "@/components/PrivateModeToggle";
import { PageContainer, SectionHeading, StatCard } from "@/components/ui";
import { AttentionList, FinCard } from "./fin-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finanse" };

const ACTIONS = [
  { href: "/invoices/new", icon: "+", label: "Dodaj fakturę kosztową", desc: "Zdjęcie lub plik, OCR sam odczyta" },
  { href: "/invoices/sprzedaz", icon: "FV", label: "Faktury sprzedażowe", desc: "Wystawione i do wystawienia" },
  { href: "/finanse/rentownosc", icon: "%", label: "Ile zostaje ze zleceń", desc: "Marża per zlecenie" },
  { href: "/finanse/terminy", icon: "!", label: "Terminy ZUS, VAT i PIT", desc: "Co i kiedy zapłacić" },
];

export default async function FinansePage() {
  const [attention, d, est] = await Promise.all([
    getFinanceAttention(),
    getDashboardData(),
    getMonthEstimatedCost(),
  ]);
  const monthName = MONTH_NAMES_PL[d.month_index];
  const estProfit = d.month.revenueNet - est.estCostNet;

  return (
    <PageContainer className="lv-home">
      <header className="lf-hero">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="lv-eyebrow">
              Finanse · {monthName} {d.year}
            </p>
            <p className="lf-hero-big" data-neg={d.month.profit < 0}>
              <Money>{fmtPLN(d.month.profit)}</Money>
            </p>
            <p className="lf-hero-sub">wynik księgowy miesiąca (netto, z faktur)</p>
          </div>
          <PrivateModeToggle />
        </div>
        <dl className="lf-chips">
          <div>
            <dt>Przychód netto</dt>
            <dd><Money>{fmtPLN(d.month.revenueNet)}</Money></dd>
          </div>
          <div>
            <dt>Koszty netto</dt>
            <dd><Money>{fmtPLN(d.month.costsNet)}</Money></dd>
          </div>
          <div>
            <dt>Wynik z wyceny</dt>
            <dd><Money>{fmtPLN(estProfit)}</Money></dd>
          </div>
          {d.pendingRevenueGross > 0 && (
            <div>
              <dt>Należności brutto</dt>
              <dd><Money>{fmtPLN(d.pendingRevenueGross)}</Money></dd>
            </div>
          )}
        </dl>
      </header>

      <AttentionList items={attention} />

      <section>
        <SectionHeading>Co chcesz zrobić?</SectionHeading>
        <div className="lf-actions">
          {ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="lf-action">
              <span aria-hidden className="lf-ico">{a.icon}</span>
              <span className="min-w-0">
                <b>{a.label}</b>
                <small>{a.desc}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading action={{ href: "/dashboard", label: "Pełny bilans" }}>
          Szczegóły miesiąca
        </SectionHeading>
        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-2.5">
          {d.monthRevenueSplit && (
            <>
              <StatCard
                label="Przychód netto z faktur"
                value={fmtPLN(d.monthRevenueSplit.invoicedNet)}
                tone="info"
                money
                hint={
                  d.monthRevenueSplit.invoicedCount > 0
                    ? `${d.monthRevenueSplit.invoicedCount} zlec. z FV`
                    : "brak wystawionych FV"
                }
              />
              <StatCard
                label="Przychód netto bez FV"
                value={fmtPLN(d.monthRevenueSplit.uninvoicedNet)}
                tone="accent"
                money
                hint={
                  d.monthRevenueSplit.uninvoicedCount > 0
                    ? `${d.monthRevenueSplit.uninvoicedCount} zlec. bez FV`
                    : "brak"
                }
              />
            </>
          )}
          <StatCard
            label="Koszt netto (wycena)"
            value={fmtPLN(est.estCostNet)}
            tone="accent"
            money
            hint={est.count > 0 ? `z wyceny · ${est.count} zlec.` : "brak wycenionych zleceń"}
          />
          {d.openDepositsTotal > 0 && (
            <StatCard label="Zaliczki otwarte brutto" value={fmtPLN(d.openDepositsTotal)} tone="info" money />
          )}
        </div>
      </section>

      <FinCard tone="muted" className="text-center">
        <p className="text-[13px] text-[var(--muted)] leading-relaxed">
          <b className="text-[var(--foreground)]">LUVIANO</b> = kontrola i analiza.{" "}
          <b className="text-[var(--foreground)]">ING Księgowość</b> = prawda księgowa (KPiR, VAT, JPK, ZUS).
        </p>
      </FinCard>
    </PageContainer>
  );
}
