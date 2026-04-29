export type JobStatus = "planned" | "in_progress" | "completed" | "paid" | "cancelled";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  planned: "Planowane",
  in_progress: "W trakcie",
  completed: "Zakończone",
  paid: "Opłacone",
  cancelled: "Anulowane",
};

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
  notes?: string | null;
};
