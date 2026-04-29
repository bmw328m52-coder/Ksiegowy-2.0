export type OCRStatus = "pending" | "processing" | "done" | "failed" | "manual";

export type Invoice = {
  id: string;
  user_id: string;
  file_path: string;
  file_mime: string | null;
  ocr_status: OCRStatus;
  ocr_raw: unknown | null;
  supplier_name: string | null;
  supplier_nip: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  payment_due: string | null;
  amount_net: string | null;
  amount_vat: string | null;
  amount_gross: string | null;
  vat_rate: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceUpdate = {
  supplier_name?: string | null;
  supplier_nip?: string | null;
  invoice_number?: string | null;
  issue_date?: string | null;
  payment_due?: string | null;
  amount_net?: number | null;
  amount_vat?: number | null;
  amount_gross?: number | null;
  vat_rate?: number | null;
  notes?: string | null;
};

export const OCR_STATUS_LABELS: Record<OCRStatus, string> = {
  pending: "Oczekuje",
  processing: "Analizuję",
  done: "Gotowe",
  failed: "Błąd OCR",
  manual: "Ręczne",
};
