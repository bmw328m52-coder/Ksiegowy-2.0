import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Money } from "@/components/Money";
import AttentionPanel from "@/components/AttentionPanel";
import { getFinanceAttention } from "@/lib/dao/finance";
import { getDashboardData, MONTH_NAMES_PL } from "@/lib/dao/dashboard";
import { fmtPLN } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finanse" };

type Tile = { href: string; label: string; desc: string; emoji: string };

const TILES: Tile[] = [
  { href: "/invoices", label: "Dokumenty", desc: "Faktury kosztowe i OCR", emoji: "🧾" },
  { href: "/finanse/rentownosc", label: "Rentowność", desc: "Marża per zlecenie", emoji: "📈" },
  { href: "/finanse/ksiegowosc", label: "Księgowość ING", desc: "Do wprowadzenia i eksport", emoji: "📚" },
  { href: "/finanse/terminy", label: "Terminy", desc: "ZUS, VAT, PIT, własne", emoji: "📅" },
  { href: "/finanse/raporty", label: "Raporty", desc: "Miesiąc + paczka PDF", emoji: "📦" },
  { href: "/dashboard", label: "Pełny dashboard", desc: "Bilans podatkowy", emoji: "📊" },
];

export default async function FinansePage() {
  const [attention, d] = await Promise.all([getFinanceAttention(), getDashboardData()]);
  const monthName = MONTH_NAMES_PL[d.month_index];

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-4">
        <PageHeader title="Finanse" back={{ href: "/" }} />

        <AttentionPanel items={attention} />

        <section className="rounded-2xl border border-[#e8e4dd] bg-white p-4">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#9c9081]">
            Bieżący miesiąc
          </p>
          <h2 className="text-sm font-semibold text-[#282624] mb-3">
            {monthName} {d.year}
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Przychód" value={fmtPLN(d.month.revenueNet)} tone="neutral" />
            <Metric label="Koszty" value={fmtPLN(d.month.costsNet)} tone="neutral" />
            <Metric
              label="Wynik"
              value={fmtPLN(d.month.profit)}
              tone={d.month.profit >= 0 ? "gold" : "negative"}
            />
          </div>
          {(d.pendingRevenueGross > 0 || d.openDepositsTotal > 0) && (
            <div className="mt-3 pt-3 border-t border-[#f1ede5] grid grid-cols-2 gap-2 text-center">
              <Metric label="Należności" value={fmtPLN(d.pendingRevenueGross)} tone="warn" small />
              <Metric label="Zaliczki otwarte" value={fmtPLN(d.openDepositsTotal)} tone="info" small />
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-2xl border border-[#e8e4dd] bg-white p-4 hover:bg-[#faf7f2] active:bg-[#f5f0e8] transition-colors"
            >
              <span className="text-2xl">{t.emoji}</span>
              <p className="mt-2 text-sm font-semibold text-[#282624]">{t.label}</p>
              <p className="text-[11px] text-[#9c9081] mt-0.5">{t.desc}</p>
            </Link>
          ))}
        </section>

        <p className="text-[11px] text-[#9c9081] text-center pt-1">
          LUVIANO = kontrola i analiza. ING Księgowość = prawda księgowa (KPiR, VAT, JPK, ZUS).
        </p>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
  small = false,
}: {
  label: string;
  value: string;
  tone: "neutral" | "gold" | "negative" | "warn" | "info";
  small?: boolean;
}) {
  const color = {
    neutral: "text-[#282624]",
    gold: "text-[#a06f3f]",
    negative: "text-[#b8523a]",
    warn: "text-[#a06f3f]",
    info: "text-[#5a7898]",
  }[tone];
  return (
    <div>
      <p className="text-[10px] text-[#9c9081] uppercase tracking-wide">{label}</p>
      <Money className={`${small ? "text-sm" : "text-base"} font-semibold tabular-nums ${color}`}>
        {value}
      </Money>
    </div>
  );
}
