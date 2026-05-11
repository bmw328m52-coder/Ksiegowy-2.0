export const PROJECT_TYPES = ["kitchen", "wardrobe", "bathroom"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  kitchen: "Kuchnia",
  wardrobe: "Szafa",
  bathroom: "Łazienka",
};

export const CHECKLIST_STATUSES = [
  "pending",
  "ordered",
  "delivered",
  "installed",
] as const;
export type ChecklistItemStatus = (typeof CHECKLIST_STATUSES)[number];

export const CHECKLIST_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  pending: "Do zamówienia",
  ordered: "Zamówione",
  delivered: "Dostarczone",
  installed: "Zamontowane",
};

export type ChecklistItem = {
  id: string;
  user_id: string;
  job_id: string;
  category: string;
  label: string;
  qty: number;
  unit: string;
  unit_price_net: number | null;
  vat_rate: number;
  supplier: string | null;
  notes: string | null;
  status: ChecklistItemStatus;
  counts_in_margin: boolean;
  cost_line_id: string | null;
  order_idx: number;
  created_at: string;
  updated_at: string;
};

export type ChecklistItemInput = {
  job_id: string;
  category: string;
  label: string;
  qty?: number;
  unit?: string;
  unit_price_net?: number | null;
  vat_rate?: number;
  supplier?: string | null;
  notes?: string | null;
  status?: ChecklistItemStatus;
  counts_in_margin?: boolean;
  order_idx?: number;
};
