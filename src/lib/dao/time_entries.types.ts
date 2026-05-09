export const WORK_PHASES = ["pomiar", "projekt", "produkcja", "montaz", "inne"] as const;
export type WorkPhase = (typeof WORK_PHASES)[number];

export const WORK_PHASE_LABELS: Record<WorkPhase, string> = {
  pomiar: "Pomiar",
  projekt: "Projekt",
  produkcja: "Produkcja",
  montaz: "Montaż",
  inne: "Inne",
};

export type TimeEntry = {
  id: string;
  user_id: string;
  job_id: string;
  phase: WorkPhase;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  source: "timer" | "manual";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ManualEntryInput = {
  job_id: string;
  phase: WorkPhase;
  date: string;
  duration_minutes: number;
  notes?: string | null;
};
