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
  | "scheduled" // scheduled_measurement (umówiony pomiar)
  | "pomiar" // to_measure (do pomiaru)
  | "uzupelnienie" // after_measure (pomiar zrobiony — uzupełnij pola do wyceny)
  | "quote" // to_quote, quote_sent
  | "production" // accepted, materials_ordered, in_production, ready_to_install
  | "done" // installed, settled
  | "archived"
  | "cancelled";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "Wszystkie",
  overdue: "Zaległe",
  leads: "Leady",
  scheduled: "Umówione pomiary",
  pomiar: "Pomiar",
  uzupelnienie: "Uzupełnienie",
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
  "scheduled",
  "pomiar",
  "uzupelnienie",
  "quote",
  "production",
  "done",
  "archived",
  "cancelled",
];

const FILTER_STATUSES: Record<Exclude<FilterKey, "all" | "overdue">, JobStatus[]> = {
  leads: ["new_inquiry"],
  scheduled: ["scheduled_measurement"],
  pomiar: ["to_measure"],
  uzupelnienie: ["after_measure"],
  quote: ["to_quote", "quote_sent"],
  production: ["accepted", "materials_ordered", "in_production", "ready_to_install"],
  done: ["installed", "settled"],
  archived: ["archived"],
  cancelled: ["cancelled"],
};

// Grupy wyświetlane gdy filter = "all" — sekcje w kolejności od najpilniejszych
const GROUP_ORDER: { key: Exclude<FilterKey, "all">; label: string }[] = [
  { key: "overdue", label: "Zaległe" },
  { key: "scheduled", label: "Umówione pomiary" },
  { key: "uzupelnienie", label: "Uzupełnienie" },
  { key: "production", label: "Produkcja" },
  { key: "quote", label: "Wycena" },
  { key: "leads", label: "Leady" },
  { key: "pomiar", label: "Pomiar" },
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

const STAGE_GROUP_ACCENT: Record<JobStatus, string> = {
  new_inquiry: "#c4bbac",
  scheduled_measurement: "#a06f3f",
  to_measure: "#a06f3f",
  after_measure: "#a06f3f",
  to_quote: "#a18653",
  quote_sent: "#a18653",
  accepted: "#5a7898",
  materials_ordered: "#5a7898",
  in_production: "#5a7898",
  ready_to_install: "#4f8a64",
  installed: "#4f8a64",
  settled: "#3a6b4d",
  archived: "#c4bbac",
  cancelled: "#c4bbac",
};

function hrefForJobStatus(id: string, status: JobStatus): string {
  switch (status) {
    case "scheduled_measurement":
    case "to_measure":
      return `/jobs/${id}/pomiar/edit`;
    case "after_measure":
      return `/jobs/${id}/pomiar/edit#uzupelnienie`;
    case "to_quote":
    case "quote_sent":
      return `/jobs/${id}/wycena`;
    default:
      return `/jobs/${id}`;
  }
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
  const accent = STAGE_GROUP_ACCENT[job.status];
  const totalStages = JOB_STATUS_WORKFLOW.length - 1;
  const completedStages = stageIdx >= 0 ? stageIdx + 1 : 0;
  const showProgress =
    stageIdx >= 0 && job.status !== "cancelled" && job.status !== "archived";
  const href = hrefForJobStatus(job.id, job.status);
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 rounded-xl border border-[#e6dcc7] bg-white p-3.5 pl-3 active:bg-[#faf7f2] hover:border-[#c4bbac] transition-colors border-l-4"
        style={{ borderLeftColor: accent }}
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
          {showProgress && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex items-center gap-[3px]" aria-hidden>
                {Array.from({ length: totalStages }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: i < completedStages ? accent : "#ece6d8",
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-[#9c9081] tabular-nums">
                {completedStages}/{totalStages}
              </span>
            </div>
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
    scheduled_measurement: "bg-[#f1e5d2] text-[#7d5530]",
    to_measure: "bg-[#f1e5d2] text-[#7d5530]",
    after_measure: "bg-[#f1e5d2] text-[#7d5530]",
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
