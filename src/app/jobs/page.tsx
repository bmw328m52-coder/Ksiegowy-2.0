import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { listJobs, JOB_STATUS_LABELS } from "@/lib/dao/jobs";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { computeJobMargin, getJobMarginsMap } from "@/lib/jobMargin";
import { getChecklistProgressMap, type ChecklistProgress } from "@/lib/dao/job_checklist";
import { fmtPLN, fmtDate } from "@/lib/format";

export const metadata = { title: "Zlecenia" };

type Filter = "all" | "invoiced" | "not_invoiced";

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter: rawFilter, q: rawQ } = await searchParams;
  const filter: Filter =
    rawFilter === "invoiced" || rawFilter === "not_invoiced" ? rawFilter : "all";
  const q = (rawQ ?? "").trim();
  const needle = normalize(q);

  const [all, settings] = await Promise.all([listJobs(), getUserSettingsOrDefault()]);
  const filteredByTab = all.filter((j) => {
    if (filter === "invoiced") return j.invoiced === true;
    if (filter === "not_invoiced") return j.invoiced !== true;
    return true;
  });
  const jobs = needle
    ? filteredByTab.filter((j) => {
        const hay = [j.title, j.client_name, j.invoice_number]
          .filter(Boolean)
          .map((v) => normalize(String(v)))
          .join(" ");
        return hay.includes(needle);
      })
    : filteredByTab;

  const jobIds = jobs.map((j) => j.id);
  const [marginsMap, checklistMap] = await Promise.all([
    getJobMarginsMap(jobIds),
    getChecklistProgressMap(jobIds),
  ]);

  const counts = {
    all: all.length,
    invoiced: all.filter((j) => j.invoiced === true).length,
    not_invoiced: all.filter((j) => j.invoiced !== true).length,
  };

  const qsForTab = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Zlecenia" back={{ href: "/" }} />

        <FilterTabs current={filter} counts={counts} qSuffix={qsForTab} />

        {all.length > 0 && (
          <form method="GET" action="/jobs" className="mb-3 flex gap-2">
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Szukaj: tytuł, klient, nr FV"
              autoComplete="off"
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#282624]/20"
            />
            {q ? (
              <Link
                href={filter === "all" ? "/jobs" : `/jobs?filter=${filter}`}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 active:bg-zinc-50"
              >
                Wyczyść
              </Link>
            ) : (
              <button
                type="submit"
                className="rounded-lg bg-[#282624] text-white px-3 py-2 text-sm font-medium active:opacity-80"
              >
                Szukaj
              </button>
            )}
          </form>
        )}

        {q && (
          <p className="text-xs text-zinc-500 mb-2">
            Wynik dla „{q}”: {jobs.length} z {filteredByTab.length}
          </p>
        )}

        {jobs.length === 0 ? (
          q ? (
            <div className="text-center py-12 text-zinc-500 space-y-3">
              <p>Brak wyników dla „{q}”.</p>
              <Link
                href={filter === "all" ? "/jobs" : `/jobs?filter=${filter}`}
                className="inline-block text-sm text-zinc-600 underline-offset-2 hover:underline"
              >
                Wyczyść filtr
              </Link>
            </div>
          ) : (
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
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {jobs.map((j) => {
              const agg = marginsMap.get(j.id);
              const lines = agg
                ? [{ amount_net: agg.costsNet, amount_gross: agg.costsGross }]
                : [];
              const m = computeJobMargin(j, lines, settings.is_vat_payer);
              const showMargin = (agg?.count ?? 0) > 0;
              return (
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
                        {showMargin && m.marginPct !== null && (
                          <MarginPill profit={m.profit} pct={m.marginPct} />
                        )}
                        <ChecklistPill progress={checklistMap.get(j.id)} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function FilterTabs({
  current,
  counts,
  qSuffix,
}: {
  current: Filter;
  counts: { all: number; invoiced: number; not_invoiced: number };
  qSuffix: string;
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
        const base = t.key === "all" ? "/jobs" : `/jobs?filter=${t.key}`;
        const href =
          t.key === "all" && qSuffix
            ? `/jobs?${qSuffix.slice(1)}`
            : `${base}${qSuffix}`;
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

function MarginPill({ profit, pct }: { profit: number; pct: number }) {
  const pos = profit >= 0;
  const cls = pos
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-red-50 text-red-700 border-red-200";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] border tabular-nums ${cls}`}
      title={`Zysk: ${profit.toFixed(2)} zł`}
    >
      {pos ? "+" : ""}
      {pct.toFixed(0)}%
    </span>
  );
}

function ChecklistPill({ progress }: { progress: ChecklistProgress | undefined }) {
  if (!progress || progress.total === 0) return null;
  const { total, installed, active } = progress;
  const done = installed === total;
  const started = active > 0;
  const cls = done
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : started
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-zinc-50 text-zinc-600 border-zinc-200";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] border tabular-nums ${cls}`}
      title={`Checklist: ${installed} zamontowane, ${active} w toku, ${total} łącznie`}
    >
      {done ? "✓ " : ""}
      {installed}/{total}
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
