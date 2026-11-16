import Link from "next/link";
import { listJobs } from "@/lib/dao/jobs";
import { listClients } from "@/lib/dao/clients";
import {
  JOB_STATUS_WORKFLOW,
  JOB_STATUS_CLOSED,
  isJobMissingSalesInvoice,
  type JobStatus,
} from "@/lib/dao/jobs.types";
import {
  jobPipelineGroup,
  PIPELINE_GROUP_ORDER,
  PIPELINE_GROUP_LABELS,
  type PipelineGroup,
} from "@/lib/jobStatusView";
import { isJobOverdue } from "@/lib/jobStatus";
import { avatarTone, clientInitials } from "@/lib/avatar";
import ProjectCard from "@/components/job/ProjectCard";
import PrivateModeToggle from "@/components/PrivateModeToggle";
import { Badge, PageContainer, SegmentedNav, EmptyState, type SegmentItem } from "@/components/ui";

export const metadata = { title: "Zlecenia i klienci" };
export const dynamic = "force-dynamic";

type FilterKey = "active" | "overdue" | "uninvoiced" | PipelineGroup | "all";
type ViewKey = "zlecenia" | "klienci";

const FILTER_LABELS: Record<FilterKey, string> = {
  active: "Aktywne",
  overdue: "Zaległe",
  uninvoiced: "Bez faktury sprzedaży",
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
  searchParams: Promise<{ q?: string; f?: string; v?: string }>;
}) {
  const { q: rawQ, f: rawF, v: rawV } = await searchParams;
  const q = (rawQ ?? "").trim();
  const needle = normalize(q);
  const view: ViewKey = rawV === "klienci" ? "klienci" : "zlecenia";
  const filter: FilterKey = isFilterKey(rawF) ? rawF : "active";

  const [all, allClients] = await Promise.all([listJobs(), listClients()]);
  const todayIso = new Date().toISOString().slice(0, 10);
  type JobRow = (typeof all)[number];

  const searched = needle
    ? all.filter((j) =>
        [j.title, j.client_name]
          .filter(Boolean)
          .map((v) => normalize(String(v)))
          .join(" ")
          .includes(needle),
      )
    : all;

  function matches(j: JobRow, key: FilterKey): boolean {
    switch (key) {
      case "all":
        return true;
      case "active":
        return !CLOSED_SET.has(j.status);
      case "overdue":
        return isJobOverdue(j, todayIso);
      case "uninvoiced":
        return isJobMissingSalesInvoice(j);
      default:
        return jobPipelineGroup(j.status) === key;
    }
  }

  const count = (key: FilterKey) => searched.filter((j) => matches(j, key)).length;

  const visible = searched
    .filter((j) => matches(j, filter))
    .sort((a, b) => {
      const oa = isJobOverdue(a, todayIso);
      const ob = isJobOverdue(b, todayIso);
      if (oa !== ob) return oa ? -1 : 1;
      const sa = JOB_STATUS_WORKFLOW.indexOf(a.status);
      const sb = JOB_STATUS_WORKFLOW.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      const da = a.due_date ?? a.start_date ?? "9999";
      const db = b.due_date ?? b.start_date ?? "9999";
      return da.localeCompare(db);
    });

  const clients = needle
    ? allClients.filter((c) =>
        [c.name, c.nip, c.phone, c.email]
          .filter(Boolean)
          .map((v) => normalize(String(v)))
          .join(" ")
          .includes(needle),
      )
    : allClients;
  const jobsByClient = new Map<string, { total: number; active: number }>();
  for (const j of all) {
    const e = jobsByClient.get(j.client_id) ?? { total: 0, active: 0 };
    e.total += 1;
    if (!CLOSED_SET.has(j.status)) e.active += 1;
    jobsByClient.set(j.client_id, e);
  }

  const href = (v: ViewKey, key?: FilterKey) =>
    `/jobs?v=${v}${key && v === "zlecenia" ? `&f=${key}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  const viewSegments: SegmentItem[] = [
    { key: "zlecenia", label: "Zlecenia", href: href("zlecenia", filter), count: count("active") },
    { key: "klienci", label: "Klienci", href: href("klienci"), count: clients.length },
  ];

  const overdueCount = count("overdue");
  const uninvoicedCount = count("uninvoiced");
  const filterSegments: SegmentItem[] = [
    { key: "active", label: "Aktywne", href: href("zlecenia", "active"), count: count("active") },
    ...(overdueCount > 0
      ? [{ key: "overdue", label: "Zaległe", href: href("zlecenia", "overdue"), count: overdueCount, tone: "warn" as const }]
      : []),
    ...(uninvoicedCount > 0 || filter === "uninvoiced"
      ? [{ key: "uninvoiced", label: "Bez faktury sprz.", href: href("zlecenia", "uninvoiced"), count: uninvoicedCount, tone: "warn" as const }]
      : []),
    ...PIPELINE_GROUP_ORDER.map((g) => ({
      key: g,
      label: PIPELINE_GROUP_LABELS[g],
      href: href("zlecenia", g),
      count: count(g),
    })),
    { key: "all", label: "Wszystkie", href: href("zlecenia", "all"), count: count("all") },
  ];

  return (
    <PageContainer width="wide" className="lv-home">
      <header className="lv-hero">
        <div className="min-w-0">
          <p className="lv-eyebrow">Zlecenia i klienci</p>
          <h1 className="lv-hello">
            {view === "zlecenia" ? "Wszystkie projekty" : "Twoi klienci"}
            <span>
              {view === "zlecenia"
                ? `${FILTER_LABELS[filter]} · ${visible.length}`
                : `${clients.length} ${clients.length === 1 ? "klient" : "klientów"}`}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PrivateModeToggle />
        </div>
      </header>

      <div className="lj-toolbar">
        <SegmentedNav items={viewSegments} activeKey={view} />
        <div className="lj-actions">
          <Link href="/jobs/new" className="lj-cta">
            + Nowe zlecenie
          </Link>
          <Link href="/clients/new" className="lj-cta" data-ghost="true">
            + Klient
          </Link>
        </div>
      </div>

      <form method="GET" action="/jobs" role="search" className="premium-search flex gap-2">
        <input type="hidden" name="v" value={view} />
        {view === "zlecenia" && filter !== "active" && <input type="hidden" name="f" value={filter} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={view === "zlecenia" ? "Szukaj: tytuł lub klient" : "Szukaj: nazwa, NIP, telefon, e-mail"}
          autoComplete="off"
          className="flex-1 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25"
        />
        {q ? (
          <Link
            href={href(view, filter)}
            className="inline-flex items-center min-h-12 rounded-xl border border-[var(--input-border)] px-4 text-sm text-[var(--muted)]"
          >
            Wyczyść
          </Link>
        ) : (
          <button type="submit" className="rounded-xl border px-4 text-sm font-semibold active:opacity-80">
            Szukaj
          </button>
        )}
      </form>

      {view === "zlecenia" ? (
        <>
          <SegmentedNav items={filterSegments} activeKey={filter} />
          {visible.length === 0 ? (
            q ? (
              <EmptyState
                icon={null}
                title={`Brak wyników dla „${q}”`}
                hint="Spróbuj innej frazy lub wyczyść filtr."
                cta={{ href: href("zlecenia", filter), label: "Wyczyść wyszukiwanie" }}
                tone="neutral"
              />
            ) : (
              <EmptyState
                icon={null}
                title={all.length === 0 ? "Brak zleceń" : `Brak zleceń: ${FILTER_LABELS[filter]}`}
                hint={all.length === 0 ? "Dodaj pierwsze zlecenie, aby zacząć." : undefined}
                cta={
                  all.length === 0
                    ? { href: "/jobs/new", label: "+ Nowe zlecenie" }
                    : { href: "/jobs?v=zlecenia&f=active", label: "Pokaż aktywne" }
                }
                tone="accent"
              />
            )
          ) : (
            <div className="lj-grid" role="list">
              {visible.map((j) => (
                <ProjectCard key={j.id} job={j} todayIso={todayIso} overdue={isJobOverdue(j, todayIso)} />
              ))}
            </div>
          )}
        </>
      ) : clients.length === 0 ? (
        <EmptyState
                icon={null}
          title={q ? `Brak wyników dla „${q}”` : "Brak klientów"}
          hint={q ? "Spróbuj innej frazy lub wyczyść filtr." : "Dodaj pierwszego klienta, aby zacząć."}
          cta={q ? { href: href("klienci"), label: "Wyczyść wyszukiwanie" } : { href: "/clients/new", label: "+ Dodaj klienta" }}
          tone="accent"
        />
      ) : (
        <div className="lj-grid" role="list">
          {clients.map((c) => {
            const tone = avatarTone(c.name);
            const n = jobsByClient.get(c.id) ?? { total: 0, active: 0 };
            return (
              <Link key={c.id} href={`/clients/${c.id}`} role="listitem" className="lj-client-card">
                <span
                  className="lj-avatar"
                  style={{ background: tone.bg, color: tone.fg }}
                  aria-hidden
                >
                  {clientInitials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="lj-client-name">{c.name}</p>
                  <p className="lj-client-sub">
                    {[c.nip && `NIP ${c.nip}`, c.phone].filter(Boolean).join(" · ") ||
                      (c.type === "company" ? "Firma" : "Osoba prywatna")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge tone={n.active > 0 ? "accent" : "neutral"}>
                    {n.active > 0 ? `${n.active} w toku` : n.total > 0 ? `${n.total} zleceń` : "brak zleceń"}
                  </Badge>
                  <span className="lj-client-sub">{c.type === "company" ? "Firma" : "Osoba"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
