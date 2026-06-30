import PageHeader from "@/components/PageHeader";
import { listJobs } from "@/lib/dao/jobs";
import { getActiveTimer, listRecentEntries, sumMinutesByJob } from "@/lib/dao/time_entries";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import TimerPanel from "./TimerPanel";

export const metadata = { title: "Licznik czasu" };

export default async function TimerPage() {
  const [jobs, active, recent, minutesByJob, settings] = await Promise.all([
    listJobs(),
    getActiveTimer(),
    listRecentEntries(20),
    sumMinutesByJob(),
    getUserSettingsOrDefault(),
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
          minutesByJob={minutesByJob}
          isVatPayer={settings.is_vat_payer}
          targetRate={settings.default_hourly_rate}
        />
      </div>
    </main>
  );
}
