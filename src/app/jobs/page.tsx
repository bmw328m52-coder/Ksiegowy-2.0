import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { listJobs, JOB_STATUS_LABELS } from "@/lib/dao/jobs";
import { fmtPLN, fmtDate } from "@/lib/format";

export const metadata = { title: "Zlecenia" };

type Filter = "all" | "invoiced" | "not_invoiced";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: Filter =
    rawFilter === "invoiced" || rawFilter === "not_invoiced" ? rawFilter : "all";

  const all = await listJobs();
  const jobs = all.filter((j) => {
    if (filter === "invoiced") return j.invoiced === true;
    if (filter === "not_invoiced") return j.invoiced !== true;
    return true;
  });

  const counts = {
    all: all.length,
    invoiced: all.filter((j) => j.invoiced === true).length,
    not_invoiced: all.filter((j) => j.invoiced !== true).length,
  };

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Zlecenia" back={{ href: "/" }} />

        <FilterTabs current={filter} counts={counts} />

        {jobs.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 space-y-4">
            <p>
              {filter === "all"
                ? "Brak zleceń. Dodaj zlecenie z poziomu klienta."
                : filter === "invoiced"
                  ? "Brak fakturowanych zleceń."
                  : "Brak niefakturowanych zleceń."}
            </p>
            {filter === "all" && (
              <Link
                href="/clients"
                className="inline-block rounded-lg bg-[#282624] text-white px-4 py-3 text-sm font-medium"
              >
                Przejdź do klientów
              </Link>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 active:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{j.title}</p>
                      <p className="text-xs text-zinc-500 truncate">{j.client_name}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {fmtPLN(j.amount_gross)} • {fmtDate(j.due_date ?? j.start_date)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={j.status} />
                      <InvoicedBadge invoiced={Boolean(j.invoiced)} />
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
  counts: { all: number; invoiced: number; not_invoiced: number };
}) {
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Wszystkie", count: counts.all },
    { key: "not_invoiced", label: "Niefakturowane", count: counts.not_invoiced },
    { key: "invoiced", label: "Fakturowane", count: counts.invoiced },
  ];
  return (
    <nav className="flex gap-1 mb-3 p-1 rounded-lg bg-zinc-100">
      {tabs.map((t) => {
        const active = t.key === current;
        const href = t.key === "all" ? "/jobs" : `/jobs?filter=${t.key}`;
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

function StatusBadge({ status }: { status: keyof typeof JOB_STATUS_LABELS }) {
  const colors: Record<string, string> = {
    planned: "bg-zinc-100 text-zinc-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-amber-100 text-amber-700",
    paid: "bg-green-100 text-green-700",
    cancelled: "bg-zinc-100 text-zinc-400 line-through",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${colors[status]}`}>
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}

function InvoicedBadge({ invoiced }: { invoiced: boolean }) {
  if (invoiced) {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
        FV
      </span>
    );
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] bg-zinc-50 text-zinc-500 border border-zinc-200">
      bez FV
    </span>
  );
}
