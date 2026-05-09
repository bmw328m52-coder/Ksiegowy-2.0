import { getActiveTimer, getJobMeta, WORK_PHASE_LABELS } from "@/lib/dao/time_entries";
import ActiveTimerBarClient from "./ActiveTimerBarClient";

export default async function ActiveTimerBar() {
  let active = null;
  try {
    active = await getActiveTimer();
  } catch {
    return null;
  }
  if (!active) return null;

  const job = await getJobMeta(active.job_id).catch(() => null);
  if (!job) return null;

  return (
    <ActiveTimerBarClient
      jobId={active.job_id}
      jobTitle={job.title}
      phaseLabel={WORK_PHASE_LABELS[active.phase]}
      startedAt={active.started_at}
    />
  );
}
