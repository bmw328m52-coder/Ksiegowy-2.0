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
  not_sent: "bg-[#f0f0ee] text-[#6f6c66]",
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

        <section className="rounded-2xl border border-[#ededea] bg-white p-4">
          <p className="text-[13px] text-[#6f6c66]">
            <span className="font-semibold text-[#1f1d1b]">ING = prawda księgowa.</span> Tu tylko
            pilnujesz, co jeszcze trzeba tam wprowadzić i eksportujesz paczkę dokumentów.
          </p>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-sm text-[#6f6c66]">Do wprowadzenia ({pendingCount}) · suma brutto</span>
            <Money className="text-base font-semibold tabular-nums text-[#a06f3f]">
              {fmtPLN(pendingSum)}
            </Money>
          </div>
        </section>

        <ExportMonthCard />

        <FilterTabs current={filter} />

        {docs.length === 0 ? (
          <p className="text-sm text-[#8d8a85] text-center py-10">
            Brak dokumentów w tym widoku.
          </p>
        ) : (
          <ul className="space-y-3">
            {docs.map((inv) => (
              <li
                key={inv.id}
                className="rounded-2xl border border-[#ededea] bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/invoices/${inv.id}`} className="min-w-0">
                    <p className="text-sm font-semibold text-[#1f1d1b] break-words">
                      {inv.supplier_name ?? "Dokument bez sprzedawcy"}
                    </p>
                    <p className="text-[13px] text-[#8d8a85] mt-0.5 break-words">
                      {inv.invoice_number ?? "—"} · {fmtDate(inv.issue_date)}
                    </p>
                  </Link>
                  <div className="shrink-0 text-right"><Money className="text-sm font-semibold tabular-nums text-[#1f1d1b]">
                    {fmtPLN(inv.amount_gross)}
                  </Money><p className="text-[12px] text-[#8d8a85]">brutto</p></div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[12px] px-2.5 py-1 rounded-full font-medium ${STATUS_PILL[inv.accounting_status]}`}
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-label="Status księgowy">
      {ACCOUNTING_STATUS_ORDER.map((s) => {
        const active = s === current;
        return (
          <form key={s} action={setAccountingStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={s} />
            <button
              type="submit"
              className={`w-full text-[13px] min-h-[44px] px-1 rounded-lg font-medium transition-colors ${
                active
                  ? "bg-[#a06f3f] text-white"
                  : "bg-[#f0f0ee] text-[#6f6c66] active:bg-[var(--surface-2)]"
              }`}
            >
              {ACCOUNTING_STATUS_LABELS[s]}
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
        className={`text-[12px] px-3 min-h-[44px] rounded-full font-medium transition-colors ${
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
    <nav aria-label="Filtr dokumentów" className="flex flex-wrap gap-1.5">
      {FILTERS.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={`/finanse/ksiegowosc?f=${t.key}`}
            className={`whitespace-nowrap text-center text-[13px] min-h-[44px] inline-flex items-center px-4 rounded-full font-semibold transition-colors ${
              active ? "bg-[var(--accent)] text-[var(--background)]" : "border border-[var(--border)] bg-[var(--surface)] text-zinc-600 active:bg-zinc-50"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
