import Link from "next/link";
import type { Metadata } from "next";
import { getFinanceAttention, getMonthEstimatedCost } from "@/lib/dao/finance";
import { getDashboardData, MONTH_NAMES_PL } from "@/lib/dao/dashboard";
import { fmtPLN } from "@/lib/format";
import { Money } from "@/components/Money";
import PrivateModeToggle from "@/components/PrivateModeToggle";
import { PageContainer, SectionHeading, StatCard } from "@/components/ui";
import { GrantSwitch } from "@/components/finance/MonthBalance";
import { AttentionList, FinCard } from "./fin-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finanse" };

const ACTIONS = [
  { href: "/invoices/new", icon: "+", label: "Dodaj fakturę kosztową", desc: "Zdjęcie lub plik, OCR sam odczyta" },
  { href: "/invoices/sprzedaz", icon: "FV", label: "Faktury sprzedażowe", desc: "Wystawione i do wystawienia" },
  { href: "/finanse/rentownosc", icon: "%", label: "Ile zostaje ze zleceń", desc: "Marża per zlecenie" },
  { href: "/finanse/terminy", icon: "!", label: "Terminy ZUS, VAT i PIT", desc: "Co i kiedy zapłacić" },
];

export default async function FinansePage({ searchParams }: { searchParams: Promise<{ dotacja?: string }> }) {
  const { dotacja } = await searchParams;
  const without = dotacja === "bez";
  const [attention, d, est] = await Promise.all([
    getFinanceAttention(),
    getDashboardData(),
    getMonthEstimatedCost(),
  ]);
  const monthName = MONTH_NAMES_PL[d.month_index];
  const grant = d.month.grantCostsGross;
  const ownCosts = d.month.costsGross - grant;
  const profitOwn = d.month.revenueGross - ownCosts;
  const profitAll = d.month.revenueGross - d.month.costsGross;
  // Główny wynik: domyślnie razem (z zakupami z dotacji); „Bez dotacji PUP” je pomija.
  const shownCosts = without ? ownCosts : d.month.costsGross;
  const shownProfit = without ? profitOwn : profitAll;
  const estProfit = d.month.revenueGross - est.estCostGross;

  return (
    <PageContainer className="lv-home">
      <header className="lf-hero">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="lv-eyebrow">
              Finanse · {monthName} {d.year}
            </p>
            <p className="lf-hero-big" data-neg={shownProfit < 0}>
              <Money>{fmtPLN(shownProfit)}</Money>
            </p>
            <p className="lf-hero-sub">
              wynik miesiąca (brutto{grant > 0 ? (without ? ", bez zakupów z dotacji PUP" : ", razem z dotacją PUP") : ""})
            </p>
          </div>
          <PrivateModeToggle />
        </div>
        <dl className="lf-chips">
          <div>
            <dt>Przychód brutto</dt>
            <dd><Money>{fmtPLN(d.month.revenueGross)}</Money></dd>
          </div>
          <div>
            <dt>{grant > 0 && without ? "Koszty brutto (bez dotacji)" : "Koszty brutto"}</dt>
            <dd><Money>{fmtPLN(shownCosts)}</Money></dd>
          </div>
          {grant > 0 && (
            <>
              <div>
                <dt>{without ? "Pominięte: zakupy z dotacji" : "w tym zakupy z dotacji PUP"}</dt>
                <dd><Money>{fmtPLN(grant)}</Money></dd>
              </div>
              <div>
                <dt>{without ? "Wynik z dotacją (razem)" : "Wynik bez dotacji PUP"}</dt>
                <dd><Money>{fmtPLN(without ? profitAll : profitOwn)}</Money></dd>
              </div>
            </>
          )}
          <div>
            <dt>Wynik z wyceny (brutto)</dt>
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

      {grant > 0 && <GrantSwitch base="/finanse" without={without} />}

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
                label="Przychód brutto z faktur"
                value={fmtPLN(d.monthRevenueSplit.invoicedGross)}
                tone="info"
                money
                hint={
                  d.monthRevenueSplit.invoicedCount > 0
                    ? `${d.monthRevenueSplit.invoicedCount} zlec. z FV`
                    : "brak wystawionych FV"
                }
              />
              <StatCard
                label="Przychód brutto bez FV"
                value={fmtPLN(d.monthRevenueSplit.uninvoicedGross)}
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
            label="Koszt brutto (wycena)"
            value={fmtPLN(est.estCostGross)}
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
