import type { ProjectType } from "./job_checklist.types";

export const QUOTE_BRIEF_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "converted",
] as const;
export type QuoteBriefStatus = (typeof QUOTE_BRIEF_STATUSES)[number];

export const QUOTE_BRIEF_STATUS_LABELS: Record<QuoteBriefStatus, string> = {
  draft: "Szkic / w trakcie",
  sent: "Wysłane",
  accepted: "Zaakceptowane",
  rejected: "Odrzucone",
  converted: "Zlecenie utworzone",
};

export type BriefData = Record<string, string | number | boolean | number[] | null>;

export type QuoteBrief = {
  id: string;
  user_id: string;
  client_id: string;
  project_type: ProjectType;
  title: string;
  visit_date: string | null;
  status: QuoteBriefStatus;
  data: BriefData;
  estimated_amount: number | null;
  notes: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteBriefInput = {
  client_id: string;
  project_type: ProjectType;
  title: string;
  visit_date?: string | null;
  status?: QuoteBriefStatus;
  data?: BriefData;
  estimated_amount?: number | null;
  notes?: string | null;
};
