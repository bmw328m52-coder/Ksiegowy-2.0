import PageHeader from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { getDashboardData, MONTH_NAMES_PL } from "@/lib/dao/dashboard";
import { CATEGORY_COLORS } from "@/lib/dao/cost_lines.types";
import { fmtPLN } from "@/lib/format";
import ExportMonthCard from "@/app/invoices/ExportMonthCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Raporty" };

export default async function RaportyPage() {
  const d = await getDashboardData();
  const monthName = MONTH_NAMES_PL[d.month_index];

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-4">
        <PageHeader title="Raporty" back={{ href: "/finanse" }} />

        <section className="rounded-2xl border border-[#ededea] bg-white overflow-hidden">
          <header className="px-4 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[#8d8a85]">
              Raport miesięczny
            </p>
            <h2 className="text-sm font-semibold text-[#1f1d1b]">
              LUVIANO · {monthName} {d.year}
            </h2>
          </header>
          <div className="px-4 pb-4 space-y-2">
            <ReportRow label="Przychód netto" value={fmtPLN(d.month.revenueNet)} />
            <ReportRow label="Koszty netto" value={fmtPLN(d.month.costsNet)} />
            <div className="h-px bg-[#eeeeed] my-1" />
            <ReportRow
              label="Wynik miesiąca"
              value={fmtPLN(d.month.profit)}
              tone={d.month.profit >= 0 ? "gold" : "negative"}
              bold
            />
            <div className="h-px bg-[#eeeeed] my-1" />
            <ReportRow label="Należności (do zapłaty przez klientów)" value={fmtPLN(d.pendingRevenueGross)} sub />
            <ReportRow label="Zaliczki otwarte" value={fmtPLN(d.openDepositsTotal)} sub />
            {d.vat && (
              <ReportRow label={`VAT do zapłaty (${d.vat.label})`} value={fmtPLN(d.vat.vatToPay)} sub />
            )}
            <ReportRow label="Zaliczka PIT (miesiąc)" value={fmtPLN(d.pit.pitMonth)} sub />
          </div>

          {d.costsByCategoryMonth.length > 0 && (
            <div className="px-4 pb-4">
              <p className="text-[10px] font-semibold text-[#8d8a85] uppercase tracking-wide mb-2">
                Koszty wg kategorii
              </p>
              <ul className="space-y-1.5">
                {d.costsByCategoryMonth.map((r) => (
                  <li key={r.category} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-[#3a3633] capitalize">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[r.category] ?? "#8d8a85" }}
                      />
                      {r.category}
                    </span>
                    <Money className="tabular-nums text-[#6f6c66]">
                      {fmtPLN(r.amountNet)}{" "}
                      <span className="text-[#8d8a85]">· {Math.round(r.share * 100)}%</span>
                    </Money>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#8d8a85] px-1">
            Paczka dokumentów (dla ING / księgowej)
          </p>
          <ExportMonthCard />
        </section>

        <section className="rounded-2xl border border-[#ededea] bg-white p-4">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#8d8a85] mb-2">
            Rok {d.year}
          </p>
          <ReportRow label="Przychód netto YTD" value={fmtPLN(d.ytd.revenueNet)} />
          <ReportRow label="Koszty netto YTD" value={fmtPLN(d.ytd.costsNet)} />
          <ReportRow
            label="Dochód YTD"
            value={fmtPLN(d.ytd.profit)}
            tone={d.ytd.profit >= 0 ? "gold" : "negative"}
            bold
          />
          <ReportRow label="Zaliczka PIT YTD" value={fmtPLN(d.ytd.pit)} sub />
        </section>
      </div>
    </main>
  );
}

function ReportRow({
  label,
  value,
  tone = "neutral",
  bold = false,
  sub = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "gold" | "negative";
  bold?: boolean;
  sub?: boolean;
}) {
  const color =
    tone === "gold"
      ? "text-[#a06f3f]"
      : tone === "negative"
        ? "text-[#b8523a]"
        : sub
          ? "text-[#8d8a85]"
          : "text-[#3a3633]";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm ${sub ? "text-[#8d8a85]" : "text-[#6f6c66]"}`}>{label}</span>
      <Money className={`tabular-nums ${bold ? "text-base font-semibold" : "text-sm"} ${color}`}>
        {value}
      </Money>
    </div>
  );
}
