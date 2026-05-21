import PageHeader from "@/components/PageHeader";
import { listJobs } from "@/lib/dao/jobs";
import { getActiveTimer, listRecentEntries } from "@/lib/dao/time_entries";
import TimerPanel from "./TimerPanel";

export const metadata = { title: "Licznik czasu" };

export default async function TimerPage() {
  const [jobs, active, recent] = await Promise.all([
    listJobs(),
    getActiveTimer(),
    listRecentEntries(20),
  ]);

  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const recentWithMeta = recent.map((e) => ({
    entry: e,
    job: jobMap.get(e.job_id) ?? null,
  }));

  const activeJob = active ? (jobMap.get(active.job_id) ?? null) : null;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Licznik czasu" back={{ href: "/" }} />
        <TimerPanel
          jobs={jobs}
          active={active}
          activeJob={activeJob}
          recent={recentWithMeta}
        />
      </div>
    </main>
  );
}
