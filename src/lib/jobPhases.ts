import type { JobStatus } from "./dao/jobs.types";

/**
 * Widok „5 faz" nad 13 statusami zlecenia. Baza i raporty zostają na statusach —
 * fazy to wyłącznie warstwa prezentacji (pasek faz, karta „Teraz", przycisk akcji).
 */
export type JobPhase = "pomiar" | "wycena" | "akceptacja" | "produkcja" | "montaz";

export const PHASES: { key: JobPhase; label: string }[] = [
  { key: "pomiar", label: "Pomiar" },
  { key: "wycena", label: "Wycena" },
  { key: "akceptacja", label: "Akceptacja" },
  { key: "produkcja", label: "Produkcja" },
  { key: "montaz", label: "Montaż" },
];

/** cancelled → null (zlecenie poza ścieżką). archived liczymy jako zamknięty montaż. */
const STATUS_PHASE: Record<JobStatus, JobPhase | null> = {
  new_inquiry: "pomiar",
  scheduled_measurement: "pomiar",
  to_measure: "pomiar",
  after_measure: "pomiar",
  to_quote: "wycena",
  quote_sent: "wycena",
  accepted: "akceptacja",
  materials_ordered: "produkcja",
  in_production: "produkcja",
  ready_to_install: "montaz",
  installed: "montaz",
  settled: "montaz",
  archived: "montaz",
  cancelled: null,
};

export function phaseOfStatus(status: JobStatus): JobPhase | null {
  return STATUS_PHASE[status];
}

export function phaseIndex(phase: JobPhase): number {
  return PHASES.findIndex((p) => p.key === phase);
}

/** Zlecenie w pełni zamknięte (wszystkie fazy „zrobione"). */
export function isJobClosed(status: JobStatus): boolean {
  return status === "settled" || status === "archived";
}

/** Zadanie na karcie „Teraz". Zawsze tylko podpowiedź — nigdy nie blokuje zmiany etapu. */
export type PhaseTask = {
  key: string;
  label: string;
  state: "done" | "todo";
  /** Krótka informacja po prawej, np. „14 lis", „3 dostawców". */
  meta?: string;
  /** Dokąd prowadzi akcja: ścieżka ("/jobs/…") albo kotwica na stronie ("#skan"). */
  href?: string;
  /** Napis akcji po prawej dla zadania „todo": „Skanuj", „Wypełnij", „Otwórz". */
  actionLabel?: string;
};

/** Dane, z których karta „Teraz" wylicza zadania. Wszystko już dostępne w page.tsx. */
export type PhaseContext = {
  jobId: string;
  status: JobStatus;
  scanCount: number;
  hasBrief: boolean;
  hasQuote: boolean; // job.calc_quote != null
  hasMaterials: boolean; // czy są pozycje w wycenie/materiałach
  startDate: string | null;
  depositAmount: number;
  depositDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  paidDate: string | null;
  invoiced: boolean;
  invoiceNumber: string | null;
};
