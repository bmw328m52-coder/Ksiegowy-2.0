import type { ProjectType } from "./job_checklist.types";

export type JobStatus =
  | "new_inquiry"
  | "scheduled_measurement"
  | "to_measure"
  | "after_measure"
  | "to_quote"
  | "quote_sent"
  | "accepted"
  | "materials_ordered"
  | "in_production"
  | "ready_to_install"
  | "installed"
  | "settled"
  | "archived"
  | "cancelled";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  new_inquiry: "Nowe zapytanie",
  scheduled_measurement: "Umówiony pomiar",
  to_measure: "Pomiar",
  after_measure: "Uzupełnienie",
  to_quote: "Do wyceny",
  quote_sent: "Wycena wysłana",
  accepted: "Zaakceptowane",
  materials_ordered: "Materiały zamówione",
  in_production: "W produkcji",
  ready_to_install: "Gotowe do montażu",
  installed: "Zamontowane",
  settled: "Rozliczone",
  archived: "Archiwum",
  cancelled: "Anulowane",
};

// Kolejność workflow (bez 'cancelled' — wyświetlane osobno)
export const JOB_STATUS_WORKFLOW: JobStatus[] = [
  "new_inquiry",
  "scheduled_measurement",
  "to_measure",
  "after_measure",
  "to_quote",
  "quote_sent",
  "accepted",
  "materials_ordered",
  "in_production",
  "ready_to_install",
  "installed",
  "settled",
  "archived",
];

// Statusy zlecenia traktowane jako "wykonane" (przychód księgowany)
export const JOB_STATUS_DONE: JobStatus[] = ["installed", "settled", "archived"];

// Statusy zamknięte (nie pojawiają się jako aktywne)
export const JOB_STATUS_CLOSED: JobStatus[] = ["settled", "archived", "cancelled"];

export type Job = {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  amount_gross: string;
  vat_rate: string;
  status: JobStatus;
  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  paid_date: string | null;
  deposit_amount: string;
  deposit_date: string | null;
  invoiced: boolean;
  invoice_number: string | null;
  invoice_date: string | null;
  project_type: ProjectType | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type JobInput = {
  client_id: string;
  title: string;
  amount_gross: number;
  vat_rate: number;
  status: JobStatus;
  start_date?: string | null;
  due_date?: string | null;
  completed_date?: string | null;
  paid_date?: string | null;
  deposit_amount?: number;
  deposit_date?: string | null;
  invoiced?: boolean;
  invoice_number?: string | null;
  invoice_date?: string | null;
  project_type?: ProjectType | null;
  notes?: string | null;
};
