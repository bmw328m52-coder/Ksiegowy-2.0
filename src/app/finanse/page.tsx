import Link from "next/link";
import type { Metadata } from "next";
import AttentionPanel from "@/components/AttentionPanel";
import { getFinanceAttention, getMonthEstimatedCost } from "@/lib/dao/finance";
import { getDashboardData, MONTH_NAMES_PL } from "@/lib/dao/dashboard";
import { fmtPLN } from "@/lib/format";
import { PageContainer, SectionHeading, StatCard, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finanse" };

type Tile = {
  href: string;
  label: string;
  desc: string;
  tone: "accent" | "info" | "ok" | "neutral";
  icon: React.ReactNode;
};

const ic = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TILES: Tile[] = [
  {
    href: "/dashboard",
    label: "Podatki",
    desc: "VAT, PIT, ZUS — bilans",
    tone: "accent",
    icon: (
      <svg {...ic}>
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 4 4 5-5" />
      </svg>
    ),
  },
  {
    href: "/invoices",
    label: "Faktury",
    desc: "Dokumenty kosztowe + OCR",
    tone: "info",
    icon: (
      <svg {...ic}>
        <path d="M5 2v20l3-2 3 2 3-2 3 2V2z" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    ),
  },
  {
    href: "/finanse/rentownosc",
    label: "Rentowność",
    desc: "Marża per zlecenie",
    tone: "ok",
    icon: (
      <svg {...ic}>
        <path d="M3 3v18h18" />
        <path d="M19 9l-5 5-4-4-4 4" />
      </svg>
    ),
  },
  {
    href: "/finanse/ksiegowosc",
    label: "Księgowość ING",
    desc: "Do wprowadzenia i eksport",
    tone: "neutral",
    icon: (
      <svg {...ic}>
        <path d="M4 4h11a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z" />
        <path d="M20 4h-1a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h1z" />
      </svg>
    ),
  },
  {
    href: "/finanse/terminy",
    label: "Terminy",
    desc: "ZUS, VAT, PIT, własne",
    tone: "info",
    icon: (
      <svg {...ic}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    ),
  },
  {
    href: "/finanse/raporty",
    label: "Raporty",
    desc: "Miesiąc + paczka PDF",
    tone: "neutral",
    icon: (
      <svg {...ic}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12" />
      </svg>
    ),
  },
];

const TONE_BOX = {
  accent: "bg-[#f1e5d2] text-[#a06f3f]",
  info: "bg-[#dde5ef] text-[#5a7898]",
  ok: "bg-[#e3efe5] text-[#4f8a64]",
  neutral: "bg-[#f0f0ee] text-[#6f6c66]",
};

export default async function FinansePage() {
  const [attention, d, est] = await Promise.all([
    getFinanceAttention(),
    getDashboardData(),
    getMonthEstimatedCost(),
  ]);
  const monthName = MONTH_NAMES_PL[d.month_index];
  const estProfit = d.month.revenueNet - est.estCostNet;

  return (
    <PageContainer>
      <header className="pt-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#1f1d1b]">Finanse</h1>
        <p className="mt-0.5 text-[13px] text-[#6f6c66]">
          Kontrola i analiza · {monthName} {d.year}
        </p>
      </header>

      <AttentionPanel items={attention} />

      {/* Bieżący miesiąc */}
      <section>
        <SectionHeading action={{ href: "/dashboard", label: "Pełny bilans" }}>
          Bieżący miesiąc
        </SectionHeading>
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard label="Przychód" value={fmtPLN(d.month.revenueNet)} tone="neutral" money />
          <StatCard label="Koszt (faktury)" value={fmtPLN(d.month.costsNet)} tone="info" money hint="z faktur kosztowych" />
          <StatCard
            label="Wynik ks."
            value={fmtPLN(d.month.profit)}
            tone={d.month.profit >= 0 ? "ok" : "warn"}
            money
          />
        </div>

        {/* Szacunek z wyceny — realny koszt materiałów, gdy nie podpinasz faktur kosztowych. */}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <StatCard
            label="Koszt (wycena)"
            value={fmtPLN(est.estCostNet)}
            tone="accent"
            money
            hint={est.count > 0 ? `z wyceny · ${est.count} zlec.` : "brak wycenionych zleceń"}
          />
          <StatCard
            label="Wynik (wycena)"
            value={fmtPLN(estProfit)}
            tone={estProfit >= 0 ? "ok" : "warn"}
            money
            hint="przychód − materiały z wyceny"
          />
        </div>

        {(d.pendingRevenueGross > 0 || d.openDepositsTotal > 0) && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {d.pendingRevenueGross > 0 && (
              <StatCard label="Należności" value={fmtPLN(d.pendingRevenueGross)} tone="warn" money href="/invoices" />
            )}
            {d.openDepositsTotal > 0 && (
              <StatCard label="Zaliczki otwarte" value={fmtPLN(d.openDepositsTotal)} tone="info" money />
            )}
          </div>
        )}
      </section>

      {/* Podstrony finansów */}
      <section>
        <SectionHeading>Moduły</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl border border-[#ededea] bg-white p-4 flex items-center gap-3 shadow-[0_1px_2px_rgba(40,38,36,0.04)] transition-all active:scale-[0.98] active:bg-[#f6f6f5] hover:border-[#d8d7d3] hover:shadow-[0_2px_8px_rgba(40,38,36,0.08)]"
            >
              <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${TONE_BOX[t.tone]}`}>
                {t.icon}
              </span>
              <span className="min-w-0 flex flex-col">
                <span className="text-[15px] font-semibold tracking-tight text-[#1f1d1b] truncate">
                  {t.label}
                </span>
                <span className="text-[12px] text-[#6f6c66] truncate">{t.desc}</span>
              </span>
              <span className="ml-auto text-[#c9c7c2] group-hover:text-[#a06f3f] transition-colors">→</span>
            </Link>
          ))}
        </div>
      </section>

      <Card tone="muted" className="text-center">
        <p className="text-[12px] text-[#6f6c66] leading-relaxed">
          <b className="text-[#4a4843]">LUVIANO</b> = kontrola i analiza.{" "}
          <b className="text-[#4a4843]">ING Księgowość</b> = prawda księgowa (KPiR, VAT, JPK, ZUS).
        </p>
      </Card>
    </PageContainer>
  );
}
