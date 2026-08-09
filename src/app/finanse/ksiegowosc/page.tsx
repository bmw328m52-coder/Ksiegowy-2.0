import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { listInvoices } from "@/lib/dao/invoices";
import {
  ACCOUNTING_STATUS_LABELS,
  ACCOUNTING_STATUS_ORDER,
  type AccountingStatus,
} from "@/lib/dao/invoices.types";
import { fmtPLN, fmtDate } from "@/lib/format";
import { setAccountingStatusAction, setPaymentStatusAction } from "../actions";
import ExportMonthCard from "@/app/invoices/ExportMonthCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Księgowość ING" };

const FILTERS: { key: string; label: string }[] = [
  { key: "todo", label: "Do wprowadzenia" },
  { key: "all", label: "Wszystkie" },
  { key: "entered", label: "W ING" },
  { key: "verified", label: "Zweryfikowane" },
];

const STATUS_PILL: Record<AccountingStatus, string> = {
  not_sent: "bg-[#f5f3ef] text-[#6f6457]",
  ready: "bg-[#f1e5d2] text-[#7d5530]",
  entered: "bg-[#dde5ef] text-[#5a7898]",
  verified: "bg-[#e3efe5] text-[#3a6b4d]",
};

export default async function KsiegowoscPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const filter = FILTERS.some((x) => x.key === f) ? (f as string) : "todo";

  const all = (await listInvoices()).filter((i) => Number(i.amount_gross) > 0);

  const docs = all.filter((i) => {
    const s = i.accounting_status;
    if (filter === "todo") return s === "not_sent" || s === "ready";
    if (filter === "entered") return s === "entered";
    if (filter === "verified") return s === "verified";
    return true;
  });

  const pendingCount = all.filter(
    (i) => i.accounting_status === "not_sent" || i.accounting_status === "ready"
  ).length;
  const pendingSum = all
    .filter((i) => i.accounting_status === "not_sent" || i.accounting_status === "ready")
    .reduce((a, i) => a + (Number(i.amount_gross) || 0), 0);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-4">
        <PageHeader title="Księgowość ING" back={{ href: "/finanse" }} />

        <section className="rounded-2xl border border-[#e8e4dd] bg-white p-4">
          <p className="text-[11px] text-[#6f6457]">
            <span className="font-semibold text-[#282624]">ING = prawda księgowa.</span> Tu tylko
            pilnujesz, co jeszcze trzeba tam wprowadzić i eksportujesz paczkę dokumentów.
          </p>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-sm text-[#6f6457]">Do wprowadzenia ({pendingCount})</span>
            <Money className="text-base font-semibold tabular-nums text-[#a06f3f]">
              {fmtPLN(pendingSum)}
            </Money>
          </div>
        </section>

        <ExportMonthCard />

        <FilterTabs current={filter} />

        {docs.length === 0 ? (
          <p className="text-sm text-[#9c9081] text-center py-10">
            Brak dokumentów w tym widoku.
          </p>
        ) : (
          <ul className="space-y-3">
            {docs.map((inv) => (
              <li
                key={inv.id}
                className="rounded-2xl border border-[#e8e4dd] bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/invoices/${inv.id}`} className="min-w-0">
                    <p className="text-sm font-semibold text-[#282624] truncate">
                      {inv.supplier_name ?? "Dokument bez sprzedawcy"}
                    </p>
                    <p className="text-[11px] text-[#9c9081] mt-0.5 truncate">
                      {inv.invoice_number ?? "—"} · {fmtDate(inv.issue_date)}
                    </p>
                  </Link>
                  <Money className="text-sm font-semibold tabular-nums text-[#282624] shrink-0">
                    {fmtPLN(inv.amount_gross)}
                  </Money>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[inv.accounting_status]}`}
                  >
                    {ACCOUNTING_STATUS_LABELS[inv.accounting_status]}
                  </span>
                  <PaymentToggle id={inv.id} paid={inv.payment_status === "paid"} />
                </div>

                <StatusStepper id={inv.id} current={inv.accounting_status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function StatusStepper({ id, current }: { id: string; current: AccountingStatus }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {ACCOUNTING_STATUS_ORDER.map((s) => {
        const active = s === current;
        return (
          <form key={s} action={setAccountingStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={s} />
            <button
              type="submit"
              className={`w-full text-[10px] py-1.5 rounded-md font-medium transition-colors ${
                active
                  ? "bg-[#a06f3f] text-white"
                  : "bg-[#f5f3ef] text-[#6f6457] active:bg-[#ece7de]"
              }`}
            >
              {ACCOUNTING_STATUS_LABELS[s].split(" ")[0]}
            </button>
          </form>
        );
      })}
    </div>
  );
}

function PaymentToggle({ id, paid }: { id: string; paid: boolean }) {
  return (
    <form action={setPaymentStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={paid ? "unpaid" : "paid"} />
      <button
        type="submit"
        className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
          paid
            ? "bg-[#e3efe5] text-[#3a6b4d]"
            : "bg-[#f4e0d9] text-[#b8523a] active:opacity-80"
        }`}
      >
        {paid ? "✓ Zapłacone" : "Niezapłacone"}
      </button>
    </form>
  );
}

function FilterTabs({ current }: { current: string }) {
  return (
    <nav className="flex gap-1 p-1 rounded-lg bg-zinc-100 overflow-x-auto">
      {FILTERS.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={`/finanse/ksiegowosc?f=${t.key}`}
            className={`flex-1 whitespace-nowrap text-center text-xs py-2 px-2 rounded-md font-medium transition-colors ${
              active ? "bg-white text-[#282624] shadow-sm" : "text-zinc-600 active:bg-zinc-50"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
