export type OCRStatus = "pending" | "processing" | "done" | "failed" | "manual";

// Status przekazania dokumentu do ING Księgowość (ING = prawda księgowa).
export type AccountingStatus = "not_sent" | "ready" | "entered" | "verified";

// Status zapłaty (FAKT, nie interpretacja podatkowa).
export type PaymentStatus = "unpaid" | "paid";

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
  // Rozszerzenie modułu Finanse (migracja 0043)
  paid_date: string | null;
  payment_status: PaymentStatus;
  payment_method: string | null;
  doc_source: string | null;
  accounting_status: AccountingStatus;
  // Numer KSeF — faktura pobrana automatycznie z KSeF (migracja 0049)
  ksef_number: string | null;
  // Zakup sfinansowany dotacją (PUP) — poza kosztami/PIT (migracja 0050)
  funded_by_grant?: boolean;
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
  paid_date?: string | null;
  payment_status?: PaymentStatus;
  payment_method?: string | null;
  doc_source?: string | null;
  accounting_status?: AccountingStatus;
};

export const OCR_STATUS_LABELS: Record<OCRStatus, string> = {
  pending: "Oczekuje",
  processing: "Analizuję",
  done: "Gotowe",
  failed: "Błąd OCR",
  manual: "Ręczne",
};

export const ACCOUNTING_STATUS_LABELS: Record<AccountingStatus, string> = {
  not_sent: "Nieprzekazane",
  ready: "Gotowe do księgowania",
  entered: "Wprowadzone do ING",
  verified: "Zweryfikowane",
};

// Kolejność procesu księgowego — do sortowania i pigułek statusu.
export const ACCOUNTING_STATUS_ORDER: AccountingStatus[] = [
  "not_sent",
  "ready",
  "entered",
  "verified",
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Niezapłacone",
  paid: "Zapłacone",
};
