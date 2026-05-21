import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { listJobs } from "@/lib/dao/jobs";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_WORKFLOW,
  type JobStatus,
} from "@/lib/dao/jobs.types";
import { isJobOverdue } from "@/lib/jobStatus";
import { fmtDate } from "@/lib/format";
import { avatarTone, clientInitials } from "@/lib/avatar";

export const metadata = { title: "Zlecenia" };
export const dynamic = "force-dynamic";

// Wirtualne grupowanie etapów do chipów (zwartych i logicznych)
type FilterKey =
  | "all"
  | "overdue"
  | "leads" // new_inquiry, to_measure
  | "quote" // after_measure, to_quote, quote_sent
  | "production" // accepted, materials_ordered, in_production, ready_to_install
  | "done" // installed, settled
  | "archived"
  | "cancelled";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "Wszystkie",
  overdue: "Zaległe",
  leads: "Leady",
  quote: "Wycena",
  production: "Produkcja",
  done: "Gotowe",
  archived: "Archiwum",
  cancelled: "Anulowane",
};

const FILTER_ORDER: FilterKey[] = [
  "all",
  "overdue",
  "leads",
  "quote",
  "production",
  "done",
  "archived",
  "cancelled",
];

const FILTER_STATUSES: Record<Exclude<FilterKey, "all" | "overdue">, JobStatus[]> = {
  leads: ["new_inquiry", "to_measure"],
  quote: ["after_measure", "to_quote", "quote_sent"],
  production: ["accepted", "materials_ordered", "in_production", "ready_to_install"],
  done: ["installed", "settled"],
  archived: ["archived"],
  cancelled: ["cancelled"],
};

// Grupy wyświetlane gdy filter = "all" — sekcje w kolejności od najpilniejszych
const GROUP_ORDER: { key: Exclude<FilterKey, "all">; label: string }[] = [
  { key: "overdue", label: "Zaległe" },
  { key: "production", label: "Produkcja" },
  { key: "quote", label: "Wycena" },
  { key: "leads", label: "Leady / pomiar" },
  { key: "done", label: "Zamontowane" },
  { key: "archived", label: "Archiwum" },
  { key: "cancelled", label: "Anulowane" },
];

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function isFilterKey(v: string | undefined): v is FilterKey {
  return !!v && (FILTER_ORDER as string[]).includes(v);
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string }>;
}) {
  const { q: rawQ, f: rawF } = await searchParams;
  const q = (rawQ ?? "").trim();
  const needle = normalize(q);
  const filter: FilterKey = isFilterKey(rawF) ? rawF : "all";

  const all = await listJobs();
  const todayIso = new Date().toISOString().slice(0, 10);

  type JobRow = (typeof all)[number];

  const searched = needle
    ? all.filter((j) => {
        const hay = [j.title, j.client_name]
          .filter(Boolean)
          .map((v) => normalize(String(v)))
          .join(" ");
        return hay.includes(needle);
      })
    : all;

  function matches(j: JobRow, key: FilterKey): boolean {
    if (key === "all") return true;
    if (key === "overdue") return isJobOverdue(j, todayIso);
    return FILTER_STATUSES[key].includes(j.status);
  }

  const counts: Record<FilterKey, number> = {
    all: searched.length,
    overdue: 0,
    leads: 0,
    quote: 0,
    production: 0,
    done: 0,
    archived: 0,
    cancelled: 0,
  };
  for (const j of searched) {
    if (isJobOverdue(j, todayIso)) counts.overdue++;
    for (const k of ["leads", "quote", "production", "done", "archived", "cancelled"] as const) {
      if (FILTER_STATUSES[k].includes(j.status)) counts[k]++;
    }
  }

  const visible = filter === "all" ? searched : searched.filter((j) => matches(j, filter));

  // Grupowanie gdy "all": zaległe na górze (mogą się powtarzać z innymi grupami)
  const groups =
    filter === "all"
      ? GROUP_ORDER.map((g) => ({
          key: g.key,
          label: g.label,
          items: searched.filter((j) => matches(j, g.key)),
        })).filter((g) => g.items.length > 0)
      : [];

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md sm:max-w-lg mx-auto">
        <PageHeader
          title="Zlecenia"
          back={{ href: "/" }}
          action={
            <Link
              href="/jobs/new"
              className="rounded-lg bg-accent text-white px-3 py-1.5 text-xs font-medium active:opacity-80"
            >
              + Nowe
            </Link>
          }
        />

        {all.length > 0 && (
          <form method="GET" action="/jobs" className="mb-3 flex gap-2">
            {filter !== "all" && <input type="hidden" name="f" value={filter} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Szukaj: tytuł, klient"
              autoComplete="off"
              className="flex-1 rounded-lg border border-[#e8e4dd] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {q ? (
              <Link
                href={filter === "all" ? "/jobs" : `/jobs?f=${filter}`}
                className="rounded-lg border border-[#e8e4dd] bg-white px-3 py-2 text-sm text-[#6b6661] active:bg-[#faf7f2]"
              >
                Wyczyść
              </Link>
            ) : (
              <button
                type="submit"
                className="rounded-lg bg-accent text-white px-3 py-2 text-sm font-medium active:opacity-80"
              >
                Szukaj
              </button>
            )}
          </form>
        )}

        {all.length > 0 && (
          <nav aria-label="Filtr etapu" className="mb-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTER_ORDER.map((k) => {
                const active = filter === k;
                const count = counts[k];
                // Ukryj puste filtry (poza "Wszystkie" i aktywnym) — chipy mieszczą się bez scrolla
                if (k !== "all" && count === 0 && !active) return null;
                const href = (() => {
                  const params = new URLSearchParams();
                  if (k !== "all") params.set("f", k);
                  if (q) params.set("q", q);
                  const qs = params.toString();
                  return qs ? `/jobs?${qs}` : "/jobs";
                })();

                return (
                  <Link
                    key={k}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors shadow-[0_1px_2px_rgba(40,38,36,0.04)]",
                      active
                        ? "border-[#282624] bg-[#282624] text-white shadow-[0_2px_6px_rgba(40,38,36,0.18)]"
                        : k === "overdue"
                          ? "border-[#e8c5b6] bg-[#f4e0d9] text-[#9c3a22] hover:bg-[#eed3c8]"
                          : "border-[#d8d2c8] bg-[#faf7f2] text-[#282624] hover:bg-white hover:border-[#c4bbac]",
                    ].join(" ")}
                  >
                    {FILTER_LABELS[k]}
                    <span
                      className={[
                        "text-[11px] tabular-nums rounded-full px-1.5 min-w-[20px] text-center font-bold",
                        active
                          ? "bg-white/25 text-white"
                          : k === "overdue"
                            ? "bg-white/70 text-[#9c3a22]"
                            : "bg-white text-[#57534e]",
                      ].join(" ")}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {q && (
          <p className="text-xs text-[#9c9081] mb-2">
            Wynik dla „{q}”: {searched.length} z {all.length}
          </p>
        )}

        {visible.length === 0 ? (
          q ? (
            <div className="text-center py-12 text-[#9c9081] space-y-3">
              <p>Brak wyników dla „{q}”.</p>
              <Link
                href={filter === "all" ? "/jobs" : `/jobs?f=${filter}`}
                className="inline-block text-sm text-[#6b6661] underline-offset-2 hover:underline"
              >
                Wyczyść filtr
              </Link>
            </div>
          ) : filter !== "all" ? (
            <div className="text-center py-12 text-[#9c9081] space-y-3">
              <p>Brak zleceń w etapie „{FILTER_LABELS[filter]}”.</p>
              <Link
                href="/jobs"
                className="inline-block text-sm text-[#6b6661] underline-offset-2 hover:underline"
              >
                Pokaż wszystkie
              </Link>
            </div>
          ) : (
            <div className="text-center py-16 text-[#9c9081] space-y-4">
              <p>Brak zleceń. Dodaj pierwsze zlecenie.</p>
              <Link
                href="/jobs/new"
                className="inline-block rounded-lg bg-accent text-white px-4 py-3 text-sm font-medium"
              >
                + Nowe zlecenie
              </Link>
            </div>
          )
        ) : filter === "all" ? (
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <section key={g.key}>
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <h2 className="text-[11px] uppercase tracking-wide font-semibold text-[#9c9081]">
                    {g.label}
                  </h2>
                  <span className="text-[11px] tabular-nums text-[#9c9081]">
                    {g.items.length}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {g.items.map((j) => (
                    <JobItem
                      key={`${g.key}-${j.id}`}
                      job={j}
                      overdue={isJobOverdue(j, todayIso)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((j) => (
              <JobItem key={j.id} job={j} overdue={isJobOverdue(j, todayIso)} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function JobItem({
  job,
  overdue,
}: {
  job: Awaited<ReturnType<typeof listJobs>>[number];
  overdue: boolean;
}) {
  const dateStr = fmtDate(job.due_date ?? job.start_date);
  const stageIdx = JOB_STATUS_WORKFLOW.indexOf(job.status);
  const tone = avatarTone(job.client_name);
  return (
    <li>
      <Link
        href={`/jobs/${job.id}`}
        className="flex items-start gap-3 rounded-xl border border-[#e6dcc7] bg-white p-3.5 active:bg-[#faf7f2] hover:border-[#c4bbac] transition-colors"
      >
        <span
          className="inline-flex w-10 h-10 rounded-full items-center justify-center text-[13px] font-bold shrink-0"
          style={{ background: tone.bg, color: tone.fg }}
          aria-hidden
        >
          {clientInitials(job.client_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate text-[14px] text-[#282624]">{job.title}</p>
          <p className="text-[11px] text-[#9c9081] truncate mt-0.5">
            {job.client_name}
            {dateStr && ` · ${dateStr}`}
          </p>
          {stageIdx >= 0 && stageIdx < JOB_STATUS_WORKFLOW.length - 1 && (
            <p className="text-[10px] text-[#c4bbac] tabular-nums mt-1">
              etap {stageIdx + 1}/{JOB_STATUS_WORKFLOW.length}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StageChip status={job.status} />
          {overdue && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#f4e0d9] text-[#b8523a]">
              Zaległe
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function StageChip({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    new_inquiry: "bg-[#f5f3ef] text-[#9c9081]",
    to_measure: "bg-[#ebe8e3] text-[#524d48]",
    after_measure: "bg-[#ebe8e3] text-[#524d48]",
    to_quote: "bg-[#faf5e9] text-[#a18653]",
    quote_sent: "bg-[#faf5e9] text-[#a18653]",
    accepted: "bg-[#dde5ef] text-[#5a7898]",
    materials_ordered: "bg-[#dde5ef] text-[#5a7898]",
    in_production: "bg-[#dde5ef] text-[#5a7898]",
    ready_to_install: "bg-[#e3efe5] text-[#4f8a64]",
    installed: "bg-[#e3efe5] text-[#4f8a64]",
    settled: "bg-[#e3efe5] text-[#3a6b4d]",
    archived: "bg-[#f5f3ef] text-[#9c9081]",
    cancelled: "bg-[#f5f3ef] text-[#9c9081] line-through",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}>
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
