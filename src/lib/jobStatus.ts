import type { JobStatus } from "./dao/jobs.types";
import { JOB_STATUS_CLOSED, JOB_STATUS_DONE } from "./dao/jobs.types";

type JobLike = {
  status: JobStatus;
  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  paid_date: string | null;
};

// W 12-stage workflow user ręcznie ustawia etap — funkcja zwraca po prostu status.
// Pozostawiona dla kompatybilności call-site'ów.
export function effectiveJobStatus(job: JobLike): JobStatus {
  return job.status;
}

export function isJobOverdue(job: JobLike, todayIso?: string): boolean {
  if (JOB_STATUS_CLOSED.includes(job.status)) return false;
  if (JOB_STATUS_DONE.includes(job.status)) return false;
  if (!job.due_date) return false;
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  return job.due_date < today;
}
