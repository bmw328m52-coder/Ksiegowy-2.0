import type { JobStatus } from "./dao/jobs.types";
import { JOB_STATUS_LABELS } from "./dao/jobs.types";

type Tone = "neutral" | "accent" | "ok" | "warn" | "info";

/** Grupy pipeline'u — spójne fazy pracy pokazywane jako filtry w /jobs. */
export type PipelineGroup =
  | "lead"
  | "pomiar"
  | "wycena"
  | "realizacja"
  | "zakonczone";

export const PIPELINE_GROUP_LABELS: Record<PipelineGroup, string> = {
  lead: "Zapytania",
  pomiar: "Pomiary",
  wycena: "Wyceny",
  realizacja: "Realizacja",
  zakonczone: "Zakończone",
};

/** Kolejność grup w pasku filtrów. */
export const PIPELINE_GROUP_ORDER: PipelineGroup[] = [
  "lead",
  "pomiar",
  "wycena",
  "realizacja",
  "zakonczone",
];

const STATUS_GROUP: Record<JobStatus, PipelineGroup> = {
  new_inquiry: "lead",
  scheduled_measurement: "lead",
  to_measure: "pomiar",
  after_measure: "pomiar",
  to_quote: "wycena",
  quote_sent: "wycena",
  accepted: "realizacja",
  materials_ordered: "realizacja",
  in_production: "realizacja",
  ready_to_install: "realizacja",
  installed: "zakonczone",
  settled: "zakonczone",
  archived: "zakonczone",
  cancelled: "zakonczone",
};

const STATUS_TONE: Record<JobStatus, Tone> = {
  new_inquiry: "info",
  scheduled_measurement: "info",
  to_measure: "accent",
  after_measure: "accent",
  to_quote: "warn",
  quote_sent: "warn",
  accepted: "ok",
  materials_ordered: "info",
  in_production: "info",
  ready_to_install: "accent",
  installed: "ok",
  settled: "ok",
  archived: "neutral",
  cancelled: "neutral",
};

export function jobStatusLabel(status: JobStatus): string {
  return JOB_STATUS_LABELS[status];
}

export function jobStatusTone(status: JobStatus): Tone {
  return STATUS_TONE[status];
}

export function jobPipelineGroup(status: JobStatus): PipelineGroup {
  return STATUS_GROUP[status];
}
