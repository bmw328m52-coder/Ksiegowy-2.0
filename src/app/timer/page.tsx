import PageHeader from "@/components/PageHeader";
import { PageContainer } from "@/components/ui";
import { listJobs } from "@/lib/dao/jobs";
import { getActiveTimer, listRecentEntries, sumMinutesByJob } from "@/lib/dao/time_entries";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { getJobMaterialCostMap } from "@/lib/dao/finance";
import { getJobMarginsMap, computeJobMarginFull } from "@/lib/jobMargin";
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

  // Marża per zlecenie = przychód − koszty (spójnie z panelem Rentowność).
  // Koszt „realny" z faktur (cost_lines), a gdy ich brak — „plan" z wyceny (job_materials).
  const ids = jobs.map((j) => j.id);
  const [costMap, matMap] = await Promise.all([
    getJobMarginsMap(ids),
    getJobMaterialCostMap(ids),
  ]);
  const marginByJob: Record<string, number> = {};
  for (const j of jobs) {
    const cost = costMap.get(j.id);
    const mat = matMap.get(j.id);
    const costLines = cost
      ? [{ amount_net: cost.costsNet, amount_gross: cost.costsGross }]
      : [];
    const materials = mat ? [{ qty: mat.gross, unit_price_gross: 1 }] : [];
    const m = computeJobMarginFull(j, costLines, materials, settings.is_vat_payer);
    marginByJob[j.id] = (cost?.count ?? 0) > 0 ? m.realProfit : m.estProfit;
  }

  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const recentWithMeta = recent.map((e) => ({
    entry: e,
    job: jobMap.get(e.job_id) ?? null,
  }));

  const activeJob = active ? (jobMap.get(active.job_id) ?? null) : null;

  return (
    <PageContainer width="narrow">
      <PageHeader title="Licznik czasu" back={{ href: "/wiecej" }} />
      <TimerPanel
        jobs={jobs}
        active={active}
        activeJob={activeJob}
        recent={recentWithMeta}
        minutesByJob={minutesByJob}
        marginByJob={marginByJob}
        targetRate={settings.default_hourly_rate}
      />
    </PageContainer>
  );
}
