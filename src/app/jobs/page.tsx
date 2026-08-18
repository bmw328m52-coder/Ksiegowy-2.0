import Link from "next/link";
import { listJobs } from "@/lib/dao/jobs";
import {
  JOB_STATUS_WORKFLOW,
  JOB_STATUS_CLOSED,
  type JobStatus,
} from "@/lib/dao/jobs.types";
import {
  jobPipelineGroup,
  jobStatusLabel,
  jobStatusTone,
  PIPELINE_GROUP_ORDER,
  PIPELINE_GROUP_LABELS,
  type PipelineGroup,
} from "@/lib/jobStatusView";
import { isJobOverdue } from "@/lib/jobStatus";
import { fmtDate } from "@/lib/format";
import { avatarTone, clientInitials } from "@/lib/avatar";
import {
  PageContainer,
  SegmentedNav,
  Badge,
  EmptyState,
  ButtonLink,
  type SegmentItem,
} from "@/components/ui";

export const metadata = { title: "Zlecenia" };
export const dynamic = "force-dynamic";

type FilterKey = "active" | "overdue" | PipelineGroup | "all";

const FILTER_LABELS: Record<FilterKey, string> = {
  active: "Aktywne",
  overdue: "Zaległe",
  lead: PIPELINE_GROUP_LABELS.lead,
  pomiar: PIPELINE_GROUP_LABELS.pomiar,
  wycena: PIPELINE_GROUP_LABELS.wycena,
  realizacja: PIPELINE_GROUP_LABELS.realizacja,
  zakonczone: PIPELINE_GROUP_LABELS.zakonczone,
  all: "Wszystkie",
};

const CLOSED_SET = new Set<JobStatus>(JOB_STATUS_CLOSED);

function isFilterKey(v: string | undefined): v is FilterKey {
  return !!v && v in FILTER_LABELS;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string }>;
}) {
  const { q: rawQ, f: rawF } = await searchParams;
  const q = (rawQ ?? "").trim();
  const needle = normalize(q);
  const filter: FilterKey = isFilterKey(rawF) ? rawF : "active";

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
    switch (key) {
      case "all":
        return true;
      case "active":
        return !CLOSED_SET.has(j.status);
      case "overdue":
        return isJobOverdue(j, todayIso);
      default:
        return jobPipelineGroup(j.status) === key;
    }
  }

  const count = (key: FilterKey) => searched.filter((j) => matches(j, key)).length;

  const visible = searched
    .filter((j) => matches(j, filter))
    .sort((a, b) => {
      const sa = JOB_STATUS_WORKFLOW.indexOf(a.status);
      const sb = JOB_STATUS_WORKFLOW.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      const da = a.due_date ?? a.start_date ?? "9999";
      const db = b.due_date ?? b.start_date ?? "9999";
      return da.localeCompare(db);
    });

  // Pasek filtrów: Aktywne, Zaległe (gdy są), 5 grup pipeline, Wszystkie
  const withQ = (key: FilterKey) =>
    `/jobs?f=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const overdueCount = count("overdue");
  const segments: SegmentItem[] = [
    { key: "active", label: "Aktywne", href: withQ("active"), count: count("active") },
    ...(overdueCount > 0
      ? [{ key: "overdue", label: "Zaległe", href: withQ("overdue"), count: overdueCount, tone: "warn" as const }]
      : []),
    ...PIPELINE_GROUP_ORDER.map((g) => ({
      key: g,
      label: PIPELINE_GROUP_LABELS[g],
      href: withQ(g),
      count: count(g),
    })),
    { key: "all", label: "Wszystkie", href: withQ("all"), count: count("all") },
  ];

  return (
    <PageContainer>
      <header className="flex items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1f1d1b]">Zlecenia</h1>
          <p className="mt-0.5 text-[12px] text-[#6f6c66]">
            {FILTER_LABELS[filter]} · {visible.length}
          </p>
        </div>
        <ButtonLink href="/jobs/new" size="sm" icon={<span className="text-[15px] leading-none">+</span>}>
          Nowe
        </ButtonLink>
      </header>

      <SegmentedNav items={segments} activeKey={filter} />

      {all.length > 0 && (
        <form method="GET" action="/jobs" className="flex gap-2">
          {filter !== "active" && <input type="hidden" name="f" value={filter} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Szukaj: tytuł lub klient"
            autoComplete="off"
            className="flex-1 rounded-xl border border-[#ededea] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a06f3f]/25"
          />
          {q ? (
            <Link
              href={withQ(filter)}
              className="rounded-xl border border-[#ededea] bg-white px-3.5 py-2.5 text-sm text-[#6f6c66] active:bg-[#f6f6f5]"
            >
              Wyczyść
            </Link>
          ) : (
            <button
              type="submit"
              className="rounded-xl bg-[#1f1d1b] text-white px-4 py-2.5 text-sm font-semibold active:opacity-80"
            >
              Szukaj
            </button>
          )}
        </form>
      )}

      {q && (
        <p className="-mt-2 text-xs text-[#8d8a85]">
          Wynik dla „{q}”: {searched.length} z {all.length}
        </p>
      )}

      {visible.length === 0 ? (
        q ? (
          <EmptyState
            icon={<SearchGlyph />}
            title={`Brak wyników dla „${q}”`}
            hint="Spróbuj innej frazy lub wyczyść filtr."
            cta={{ href: withQ(filter), label: "Wyczyść wyszukiwanie" }}
            tone="neutral"
          />
        ) : filter === "active" || filter === "all" ? (
          <EmptyState
            icon={<JobsGlyph />}
            title="Brak zleceń"
            hint="Dodaj pierwsze zlecenie, aby zacząć."
            cta={{ href: "/jobs/new", label: "+ Nowe zlecenie" }}
            tone="accent"
          />
        ) : (
          <EmptyState
            icon={<JobsGlyph />}
            title={`Brak zleceń w etapie „${FILTER_LABELS[filter]}”`}
            cta={{ href: "/jobs?f=active", label: "Pokaż aktywne" }}
            tone="info"
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((j) => (
            <JobItem key={j.id} job={j} overdue={isJobOverdue(j, todayIso)} />
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

const STAGE_ACCENT: Record<JobStatus, string> = {
  new_inquiry: "#c9c7c2",
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
  archived: "#c9c7c2",
  cancelled: "#c9c7c2",
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
  const accent = STAGE_ACCENT[job.status];
  const totalStages = JOB_STATUS_WORKFLOW.length - 1;
  const completedStages = stageIdx >= 0 ? stageIdx + 1 : 0;
  const showProgress =
    stageIdx >= 0 && job.status !== "cancelled" && job.status !== "archived";
  const href = hrefForJobStatus(job.id, job.status);
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 rounded-2xl border border-[#ededea] bg-white p-3.5 pl-3 active:bg-[#f6f6f5] hover:border-[#d8d7d3] hover:shadow-[0_2px_8px_rgba(40,38,36,0.06)] transition-all border-l-4 shadow-[0_1px_2px_rgba(40,38,36,0.04)]"
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
          <p className="font-semibold truncate text-[14px] text-[#1f1d1b]">{job.title}</p>
          <p className="text-[11px] text-[#8d8a85] truncate mt-0.5">
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
                    style={{ backgroundColor: i < completedStages ? accent : "#ece6d8" }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-[#8d8a85] tabular-nums">
                {completedStages}/{totalStages}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Badge>
          {overdue && <Badge tone="warn" dot>Zaległe</Badge>}
        </div>
      </Link>
    </li>
  );
}

function SearchGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function JobsGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="18" rx="2" />
      <path d="M9 2h6a1 1 0 0 1 1 1v3H8V3a1 1 0 0 1 1-1z" />
      <path d="M8 12h8M8 16h5" />
    </svg>
  );
}
