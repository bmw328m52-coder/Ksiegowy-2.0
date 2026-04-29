import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { listInvoices, OCR_STATUS_LABELS } from "@/lib/dao/invoices";
import { fmtDate, fmtPLN } from "@/lib/format";

export const dynamic = "force-dynamic";

type Filter = "all" | "todo" | "done";

function needsReview(inv: { ocr_status: string; supplier_name: string | null; amount_gross: string | null }): boolean {
  if (inv.ocr_status === "failed") return true;
  if (inv.ocr_status === "pending" || inv.ocr_status === "processing") return false;
  return !inv.supplier_name || !inv.amount_gross;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: Filter =
    rawFilter === "todo" || rawFilter === "done" ? rawFilter : "all";

  const all = await listInvoices();
  const invoices = all.filter((inv) => {
    if (filter === "todo") return needsReview(inv);
    if (filter === "done") return !needsReview(inv) && inv.ocr_status !== "pending" && inv.ocr_status !== "processing";
    return true;
  });

  const counts = {
    all: all.length,
    todo: all.filter(needsReview).length,
    done: all.filter((inv) => !needsReview(inv) && inv.ocr_status !== "pending" && inv.ocr_status !== "processing").length,
  };

  return (
    <main className="flex flex-1 flex-col px-6 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader
          title="Faktury"
          back={{ href: "/" }}
          action={
            <Link
              href="/invoices/new"
              className="rounded-lg bg-[#282624] text-white text-sm px-3 py-2 font-medium active:opacity-80"
            >
              + Dodaj
            </Link>
          }
        />

        {all.length > 0 && <FilterTabs current={filter} counts={counts} />}

        {all.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center">
            <p className="text-sm text-zinc-600 mb-3">Brak faktur. Dodaj pierwszą.</p>
            <Link
              href="/invoices/new"
              className="inline-block rounded-lg bg-[#282624] text-white text-sm px-4 py-2 font-medium"
            >
              Wgraj fakturę
            </Link>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 space-y-3">
            <p>
              {filter === "todo"
                ? "Brak faktur do uzupełnienia."
                : "Brak gotowych faktur."}
            </p>
            <Link
              href="/invoices"
              className="inline-block text-sm text-zinc-600 underline-offset-2 hover:underline"
            >
              Pokaż wszystkie
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-3 active:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {inv.supplier_name ?? "—"}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {inv.invoice_number ?? "bez numeru"} • {fmtDate(inv.issue_date)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-medium text-sm">{fmtPLN(inv.amount_gross)}</span>
                      <StatusBadge status={inv.ocr_status} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function FilterTabs({
  current,
  counts,
}: {
  current: Filter;
  counts: { all: number; todo: number; done: number };
}) {
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Wszystkie", count: counts.all },
    { key: "todo", label: "Do uzupełnienia", count: counts.todo },
    { key: "done", label: "Gotowe", count: counts.done },
  ];
  return (
    <nav className="flex gap-1 mb-3 p-1 rounded-lg bg-zinc-100">
      {tabs.map((t) => {
        const active = t.key === current;
        const href = t.key === "all" ? "/invoices" : `/invoices?filter=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            className={`flex-1 text-center text-xs py-2 px-2 rounded-md font-medium transition-colors ${
              active
                ? "bg-white text-[#282624] shadow-sm"
                : "text-zinc-600 active:bg-zinc-50"
            }`}
          >
            {t.label} <span className="text-zinc-400">({t.count})</span>
          </Link>
        );
      })}
    </nav>
  );
}

function StatusBadge({ status }: { status: keyof typeof OCR_STATUS_LABELS }) {
  const cls: Record<string, string> = {
    pending: "bg-zinc-100 text-zinc-600",
    processing: "bg-blue-50 text-blue-700",
    done: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    manual: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${cls[status] ?? cls.pending}`}>
      {OCR_STATUS_LABELS[status]}
    </span>
  );
}
