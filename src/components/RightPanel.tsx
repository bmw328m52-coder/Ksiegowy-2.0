import Link from "next/link";
import { listJobs } from "@/lib/dao/jobs";
import type { JobStatus } from "@/lib/dao/jobs.types";
import { fmtDate } from "@/lib/format";

const CLOSED = new Set<JobStatus>(["settled", "archived", "cancelled"]);
const DONE = new Set<JobStatus>(["installed", "settled", "archived"]);

type UpcomingItem = {
  jobId: string;
  title: string;
  clientName: string;
  dateIso: string;
  kind: "measure" | "deadline" | "install";
};

async function getUpcoming(limit = 5): Promise<UpcomingItem[]> {
  const jobs = await listJobs().catch(() => []);
  const todayIso = new Date().toISOString().slice(0, 10);
  const in14DaysIso = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const items: UpcomingItem[] = [];
  for (const j of jobs) {
    if (CLOSED.has(j.status)) continue;
    if (DONE.has(j.status)) continue;
    if (j.start_date && j.start_date >= todayIso && j.start_date <= in14DaysIso) {
      items.push({
        jobId: j.id,
        title: j.title,
        clientName: j.client_name,
        dateIso: j.start_date,
        kind: j.status === "ready_to_install" ? "install" : "measure",
      });
    }
    if (j.due_date && j.due_date >= todayIso && j.due_date <= in14DaysIso) {
      items.push({
        jobId: j.id,
        title: j.title,
        clientName: j.client_name,
        dateIso: j.due_date,
        kind: "deadline",
      });
    }
  }
  items.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  return items.slice(0, limit);
}

function whenLabel(iso: string, todayIso: string): string {
  const days = Math.round(
    (new Date(iso + "T00:00:00").getTime() - new Date(todayIso + "T00:00:00").getTime()) / 86_400_000,
  );
  if (days === 0) return "dziś";
  if (days === 1) return "jutro";
  if (days < 7) {
    return new Intl.DateTimeFormat("pl-PL", { weekday: "short" }).format(
      new Date(iso + "T00:00:00"),
    );
  }
  return fmtDate(iso);
}

export default async function RightPanel() {
  const upcoming = await getUpcoming();
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:sticky lg:top-[18px] lg:h-[calc(100vh-36px)] lg:w-[300px] lg:rounded-[18px] lg:border lg:border-[#ededea] lg:bg-white lg:px-4 lg:py-5 lg:z-20 lg:overflow-y-auto"
      aria-label="Panel pomocniczy"
    >
      <PanelHeader>Szybkie narzędzia</PanelHeader>
      <div className="flex flex-col gap-2">
        <ToolRow
          href="/calculator"
          label="Wycena na czysto"
          name="Kalkulator"
          icon={<CalcIcon />}
          tone="accent"
        />
        <ToolRow
          href="/usluga"
          label="Robocizna /h"
          name="Stawka usługi"
          icon={<ClockIcon />}
          tone="accent"
        />
      </div>

      <PanelHeader className="mt-5">Najbliższe terminy</PanelHeader>
      {upcoming.length === 0 ? (
        <div className="rounded-xl border border-[#ededea] bg-white px-3 py-4 text-center text-[12px] text-[#8d8a85]">
          Brak nadchodzących terminów
        </div>
      ) : (
        <div className="rounded-xl border border-[#ededea] bg-white divide-y divide-[#eeeeed] overflow-hidden">
          {upcoming.map((u, i) => (
            <UpcomingRow key={`${u.jobId}-${u.kind}-${i}`} item={u} when={whenLabel(u.dateIso, todayIso)} />
          ))}
        </div>
      )}

      <div className="flex-1" />

      <Link
        href="/jobs"
        className="mt-5 text-center text-[12px] font-semibold text-[#a06f3f] py-2 rounded-lg border border-[#ededea] bg-white active:bg-[#f6f6f5] hover:border-[#a06f3f]"
      >
        Wszystkie zlecenia →
      </Link>
    </aside>
  );
}

function PanelHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10px] uppercase tracking-[2px] font-semibold text-[#8d8a85] mb-2 px-1 ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

function ToolRow({
  href,
  label,
  name,
  icon,
  tone,
}: {
  href: string;
  label: string;
  name: string;
  icon: React.ReactNode;
  tone: "info" | "ok" | "warn" | "accent";
}) {
  const toneClasses = {
    info: "bg-[#dde5ef] text-[#5a7898]",
    ok: "bg-[#e3efe5] text-[#4f8a64]",
    warn: "bg-[#f4e0d9] text-[#b8523a]",
    accent: "bg-[#f1e5d2] text-[#a06f3f]",
  }[tone];
  return (
    <Link
      href={href}
      className="rounded-xl border border-[#ededea] bg-white px-3 py-3 flex items-center gap-3 active:bg-[#f6f6f5] hover:border-[#c9c7c2] transition-colors"
    >
      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${toneClasses}`}>
        {icon}
      </span>
      <span className="min-w-0 flex flex-col">
        <span className="text-[10px] uppercase tracking-wide text-[#8d8a85]">{label}</span>
        <span className="text-[13px] font-semibold text-[#1f1d1b] truncate">{name}</span>
      </span>
    </Link>
  );
}

function UpcomingRow({
  item,
  when,
}: {
  item: UpcomingItem;
  when: string;
}) {
  const dot = {
    measure: "bg-[#5a7898]",
    install: "bg-[#4f8a64]",
    deadline: "bg-[#b8523a]",
  }[item.kind];
  const kindLabel = {
    measure: "Pomiar",
    install: "Montaż",
    deadline: "Termin",
  }[item.kind];
  return (
    <Link
      href={`/jobs/${item.jobId}`}
      className="flex items-start gap-2.5 px-3 py-2.5 active:bg-[#f6f6f5]"
    >
      <span aria-hidden className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[#1f1d1b] truncate leading-tight">
          {kindLabel} · {item.title}
        </p>
        <p className="text-[11px] text-[#8d8a85] truncate mt-0.5">
          {item.clientName}
        </p>
      </div>
      <span className="text-[11px] font-medium text-[#6f6c66] shrink-0 tabular-nums">
        {when}
      </span>
    </Link>
  );
}

function CalcIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
      <path d="M8 16h.01" />
      <path d="M12 16h.01" />
      <path d="M16 16h.01" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
