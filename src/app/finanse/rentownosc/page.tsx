import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { listJobProfitability } from "@/lib/dao/finance";
import { JOB_STATUS_LABELS } from "@/lib/dao/jobs.types";
import { fmtPLN } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rentowność" };

type Basis = "net" | "gross";

export default async function RentownoscPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const { b } = await searchParams;
  const basis: Basis = b === "gross" ? "gross" : "net";
  const { rows, isVatPayer } = await listJobProfitability();

  // Kwoty netto sensowne tylko dla VAT-owca; dla nie-VAT-owca netto = brutto.
  const useNet = basis === "net" && isVatPayer;

  const active = rows.filter((r) => r.job.status !== "cancelled");
  const totalRevenue = active.reduce(
    (a, r) => a + (useNet ? r.margin.revenueNet : r.margin.revenueGross),
    0
  );
  const totalCost = active.reduce((a, r) => {
    const m = r.margin;
    const real = m.invoiceCount > 0;
    return a + (useNet
      ? real ? m.invoiceCostsNet : m.materialCostNet
      : real ? m.invoiceCostsGross : m.materialCostGross);
  }, 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-4">
        <PageHeader title="Rentowność" back={{ href: "/finanse" }} />

        <BasisToggle basis={basis} disabledNet={!isVatPayer} />

        <section className="rounded-2xl border border-[#e8e4dd] bg-white p-4 grid grid-cols-3 gap-2 text-center">
          <Sum label="Przychód" value={fmtPLN(totalRevenue)} tone="neutral" />
          <Sum label="Koszty" value={fmtPLN(totalCost)} tone="neutral" />
          <Sum
            label="Zysk"
            value={fmtPLN(totalProfit)}
            tone={totalProfit >= 0 ? "gold" : "negative"}
          />
        </section>

        {active.length === 0 ? (
          <p className="text-sm text-[#9c9081] text-center py-10">
            Brak zleceń. Dodaj zlecenie i wycenę, żeby liczyć marżę.
          </p>
        ) : (
          <ul className="space-y-3">
            {active.map((r) => (
              <JobRow key={r.job.id} row={r} useNet={useNet} />
            ))}
          </ul>
        )}

        <p className="text-[11px] text-[#9c9081] text-center pt-1">
          Koszt „plan” = materiały z wyceny. Koszt „realny” = faktury kosztowe przypięte do zlecenia.
        </p>
      </div>
    </main>
  );
}

function JobRow({
  row,
  useNet,
}: {
  row: Awaited<ReturnType<typeof listJobProfitability>>["rows"][number];
  useNet: boolean;
}) {
  const { job, margin: m } = row;
  const real = m.invoiceCount > 0;
  const revenue = useNet ? m.revenueNet : m.revenueGross;
  const cost = useNet
    ? real ? m.invoiceCostsNet : m.materialCostNet
    : real ? m.invoiceCostsGross : m.materialCostGross;
  const profit = revenue - cost;
  const pct = revenue > 0 ? (profit / revenue) * 100 : null;

  return (
    <li>
      <Link
        href={`/jobs/${job.id}`}
        className="block rounded-2xl border border-[#e8e4dd] bg-white p-4 hover:bg-[#faf7f2] active:bg-[#f5f0e8] transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#282624] truncate">{job.title}</p>
            <p className="text-[11px] text-[#9c9081] mt-0.5 truncate">
              {job.client_name} · {JOB_STATUS_LABELS[job.status]}
            </p>
          </div>
          {pct !== null ? (
            <MarginBadge pct={pct} />
          ) : (
            <span className="text-[10px] text-[#9c9081] rounded-full bg-[#f5f3ef] px-2 py-0.5">
              brak danych
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <Cell label="Przychód" value={fmtPLN(revenue)} />
          <Cell
            label={real ? `Koszt real. (${m.invoiceCount})` : "Koszt plan."}
            value={cost > 0 ? fmtPLN(cost) : "—"}
          />
          <Cell
            label="Zysk"
            value={fmtPLN(profit)}
            tone={profit >= 0 ? "gold" : "negative"}
          />
        </div>
        {!real && (
          <p className="mt-2 text-[10px] text-[#b08968]">
            Szacunek z wyceny — przypnij faktury kosztowe, by policzyć realny wynik.
          </p>
        )}
      </Link>
    </li>
  );
}

function Cell({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "gold" | "negative";
}) {
  const color =
    tone === "gold" ? "text-[#a06f3f]" : tone === "negative" ? "text-[#b8523a]" : "text-[#282624]";
  return (
    <div>
      <p className="text-[10px] text-[#9c9081]">{label}</p>
      <Money className={`text-sm font-medium tabular-nums ${color}`}>{value}</Money>
    </div>
  );
}

function Sum({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "gold" | "negative";
}) {
  const color =
    tone === "gold" ? "text-[#a06f3f]" : tone === "negative" ? "text-[#b8523a]" : "text-[#282624]";
  return (
    <div>
      <p className="text-[10px] text-[#9c9081] uppercase tracking-wide">{label}</p>
      <Money className={`text-base font-semibold tabular-nums ${color}`}>{value}</Money>
    </div>
  );
}

function MarginBadge({ pct }: { pct: number }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
        pct >= 20
          ? "bg-[#e3efe5] text-[#3a6b4d]"
          : pct >= 0
            ? "bg-[#faf5e9] text-[#a18653]"
            : "bg-red-100 text-red-700"
      }`}
    >
      {pct.toFixed(1)}%
    </span>
  );
}

function BasisToggle({ basis, disabledNet }: { basis: Basis; disabledNet: boolean }) {
  const opts: { key: Basis; label: string }[] = [
    { key: "net", label: "Netto" },
    { key: "gross", label: "Brutto" },
  ];
  return (
    <nav className="flex gap-1 p-1 rounded-lg bg-zinc-100">
      {opts.map((o) => {
        const active = o.key === basis;
        const isDisabled = o.key === "net" && disabledNet;
        return (
          <Link
            key={o.key}
            href={`/finanse/rentownosc?b=${o.key}`}
            aria-disabled={isDisabled}
            className={`flex-1 text-center text-xs py-2 px-2 rounded-md font-medium transition-colors ${
              active ? "bg-white text-[#282624] shadow-sm" : "text-zinc-600 active:bg-zinc-50"
            } ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
