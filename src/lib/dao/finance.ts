import { createClient } from "@/lib/supabase/server";
import { listJobs } from "./jobs";
import { getJobMarginsMap, computeJobMarginFull, type JobMarginFull } from "@/lib/jobMargin";
import { getUserSettingsOrDefault } from "./user_settings";
import { listDeadlines } from "./deadlines";
import { JOB_STATUS_DONE, type Job, type JobStatus } from "./jobs.types";

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysFrom(iso: string, now: Date = new Date()): number {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

// ------------------------------------------------------------
// Koszt materiałów z wyceny (job_materials) zbiorczo, jednym zapytaniem.
// ------------------------------------------------------------
export async function getJobMaterialCostMap(
  jobIds: string[]
): Promise<Map<string, { gross: number; count: number }>> {
  const out = new Map<string, { gross: number; count: number }>();
  if (jobIds.length === 0) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_materials")
    .select("job_id, qty, unit_price_gross")
    .in("job_id", jobIds);
  if (error) throw error;
  for (const r of (data ?? []) as {
    job_id: string;
    qty: string | number;
    unit_price_gross: string | number | null;
  }[]) {
    const cur = out.get(r.job_id) ?? { gross: 0, count: 0 };
    cur.gross += toNum(r.qty) * toNum(r.unit_price_gross);
    cur.count += 1;
    out.set(r.job_id, cur);
  }
  return out;
}

// Szacunkowy koszt z WYCENY (job_materials) dla zleceń, których przychód wpada
// w bieżący miesiąc (opłacone/zamontowane/rozliczone) — odpowiednik kosztu z faktur
// (cost_lines), gdy faktur kosztowych brak. Ta sama data przychodu co w dashboardzie.
export async function getMonthEstimatedCost(
  now: Date = new Date()
): Promise<{ estCostNet: number; estCostGross: number; count: number }> {
  const supabase = await createClient();
  const settings = await getUserSettingsOrDefault();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const monthStart = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  const last = new Date(year, monthIdx + 1, 0);
  const monthEnd = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("jobs")
    .select("id, vat_rate, paid_date, completed_date")
    .in("status", ["installed", "settled", "archived"]);
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string;
    vat_rate: string | number;
    paid_date: string | null;
    completed_date: string | null;
  }[];
  const monthJobs = rows.filter((j) => {
    const d = j.paid_date ?? j.completed_date ?? null;
    return d !== null && d >= monthStart && d <= monthEnd;
  });

  const matMap = await getJobMaterialCostMap(monthJobs.map((j) => j.id));
  let estCostNet = 0;
  let estCostGross = 0;
  let count = 0;
  for (const j of monthJobs) {
    const mat = matMap.get(j.id);
    if (!mat || mat.gross <= 0) continue;
    const rate = toNum(j.vat_rate);
    const net = settings.is_vat_payer && rate > 0 ? mat.gross / (1 + rate) : mat.gross;
    estCostGross += mat.gross;
    estCostNet += net;
    count += 1;
  }
  return { estCostNet, estCostGross, count };
}

export type JobProfitability = {
  job: Job & { client_name: string };
  margin: JobMarginFull;
};

// Rentowność wszystkich zleceń: przychód z wartości zlecenia, koszty z dwóch źródeł
// (materiały z wyceny = plan; faktury kosztowe = rzeczywistość). Sortowane od najniższej marży.
export async function listJobProfitability(): Promise<{
  rows: JobProfitability[];
  isVatPayer: boolean;
}> {
  const [jobs, settings] = await Promise.all([listJobs(), getUserSettingsOrDefault()]);
  const ids = jobs.map((j) => j.id);
  const [costMap, matMap] = await Promise.all([
    getJobMarginsMap(ids),
    getJobMaterialCostMap(ids),
  ]);

  const rows: JobProfitability[] = jobs.map((job) => {
    const cost = costMap.get(job.id);
    const mat = matMap.get(job.id);
    // computeJobMarginFull oczekuje list; podajemy zsumowane atrapy o właściwych sumach.
    const costLines = cost
      ? [{ amount_net: cost.costsNet, amount_gross: cost.costsGross }]
      : [];
    const materials = mat ? [{ qty: mat.gross, unit_price_gross: 1 }] : [];
    const margin = computeJobMarginFull(job, costLines, materials, settings.is_vat_payer);
    // Podmieniamy count na realne liczby (atrapy mają length 1).
    margin.invoiceCount = cost?.count ?? 0;
    margin.materialCount = mat?.count ?? 0;
    return { job, margin };
  });

  rows.sort((a, b) => {
    const am = a.margin.invoiceCount > 0 ? a.margin.realMarginPct : a.margin.estMarginPct;
    const bm = b.margin.invoiceCount > 0 ? b.margin.realMarginPct : b.margin.estMarginPct;
    return (am ?? Infinity) - (bm ?? Infinity);
  });

  return { rows, isVatPayer: settings.is_vat_payer };
}

// ------------------------------------------------------------
// Silnik „WYMAGA UWAGI" — reguły kontrolne (LUVIANO = kontrola).
// ------------------------------------------------------------
export type AttentionSeverity = "high" | "medium" | "low";

export type AttentionItem = {
  kind: string;
  severity: AttentionSeverity;
  title: string;
  hint: string;
  href: string;
  amount: number | null;
  count: number | null;
};

const SEVERITY_RANK: Record<AttentionSeverity, number> = { high: 0, medium: 1, low: 2 };

type InvoiceAttnRow = {
  id: string;
  ocr_status: string;
  supplier_name: string | null;
  amount_gross: string | null;
  payment_status: string | null;
  payment_due: string | null;
  accounting_status: string | null;
};

export async function getFinanceAttention(now: Date = new Date()): Promise<AttentionItem[]> {
  const supabase = await createClient();
  const today = todayIso(now);

  const [invRes, prof, deadlines] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, ocr_status, supplier_name, amount_gross, payment_status, payment_due, accounting_status"
      ),
    listJobProfitability(),
    listDeadlines(),
  ]);

  const items: AttentionItem[] = [];
  const invoices = (invRes.error ? [] : (invRes.data ?? [])) as InvoiceAttnRow[];

  // 1) Faktury do uzupełnienia (OCR nieudany lub brak sprzedawcy/kwoty).
  const toReview = invoices.filter(
    (i) =>
      i.ocr_status === "failed" ||
      ((i.ocr_status === "done" || i.ocr_status === "manual") &&
        (!i.supplier_name || !i.amount_gross))
  );
  if (toReview.length > 0) {
    items.push({
      kind: "invoice_review",
      severity: "high",
      title: `Faktury do uzupełnienia (${toReview.length})`,
      hint: "OCR nie odczytał wszystkiego — sprawdź sprzedawcę i kwotę.",
      href: "/invoices?filter=todo",
      amount: null,
      count: toReview.length,
    });
  }

  // 2) Faktury niezapłacone po terminie płatności.
  const overdue = invoices.filter(
    (i) =>
      (i.payment_status ?? "unpaid") !== "paid" &&
      i.payment_due &&
      i.payment_due < today
  );
  if (overdue.length > 0) {
    const sum = overdue.reduce((a, i) => a + toNum(i.amount_gross), 0);
    items.push({
      kind: "invoice_overdue",
      severity: "high",
      title: `Niezapłacone po terminie (${overdue.length})`,
      hint: "Faktury kosztowe z minionym terminem płatności.",
      href: "/invoices",
      amount: sum,
      count: overdue.length,
    });
  }

  // 3) Dokumenty do wprowadzenia do ING (nieprzekazane lub gotowe).
  const toIng = invoices.filter(
    (i) =>
      toNum(i.amount_gross) > 0 &&
      ((i.accounting_status ?? "not_sent") === "not_sent" ||
        (i.accounting_status ?? "not_sent") === "ready")
  );
  if (toIng.length > 0) {
    items.push({
      kind: "accounting_pending",
      severity: "medium",
      title: `Do wprowadzenia do ING (${toIng.length})`,
      hint: "Dokumenty jeszcze nieoznaczone jako wprowadzone do ING Księgowość.",
      href: "/finanse/ksiegowosc",
      amount: null,
      count: toIng.length,
    });
  }

  // 4) Należności — zlecenia zamontowane, jeszcze nieopłacone.
  let receivables = 0;
  let receivablesCount = 0;
  // 5) Zlecenia ukończone bez wystawionej faktury sprzedaży.
  let uninvoiced = 0;
  let uninvoicedCount = 0;
  // 6) Zlecenia ze stratą (realne koszty > przychód).
  let lossCount = 0;
  for (const { job, margin } of prof.rows) {
    if (job.status === "installed" && !job.paid_date) {
      receivables += toNum(job.amount_gross);
      receivablesCount += 1;
    }
    if (
      (JOB_STATUS_DONE as JobStatus[]).includes(job.status) &&
      !job.invoiced &&
      toNum(job.amount_gross) > 0
    ) {
      uninvoiced += toNum(job.amount_gross);
      uninvoicedCount += 1;
    }
    if (margin.invoiceCount > 0 && margin.realProfit < 0) {
      lossCount += 1;
    }
  }
  if (receivablesCount > 0) {
    items.push({
      kind: "receivables",
      severity: "medium",
      title: `Oczekuje na zapłatę (${receivablesCount})`,
      hint: "Zlecenia zamontowane, jeszcze nieopłacone przez klienta.",
      href: "/finanse/rentownosc",
      amount: receivables,
      count: receivablesCount,
    });
  }
  if (uninvoicedCount > 0) {
    items.push({
      kind: "uninvoiced",
      severity: "low",
      title: `Bez faktury sprzedaży (${uninvoicedCount})`,
      hint: "Zlecenia zakończone bez wystawionej faktury dla klienta.",
      href: "/jobs",
      amount: uninvoiced,
      count: uninvoicedCount,
    });
  }
  if (lossCount > 0) {
    items.push({
      kind: "job_loss",
      severity: "high",
      title: `Zlecenia pod kreską (${lossCount})`,
      hint: "Realne koszty z faktur przekraczają wartość zlecenia.",
      href: "/finanse/rentownosc",
      amount: null,
      count: lossCount,
    });
  }

  // 7) Własne terminy urzędowe ≤ 7 dni (lub po terminie), nieodhaczone.
  const soon = deadlines.filter((d) => !d.done && daysFrom(d.due_date, now) <= 7);
  for (const d of soon) {
    const days = daysFrom(d.due_date, now);
    items.push({
      kind: "deadline",
      severity: days < 0 ? "high" : "medium",
      title: d.title,
      hint:
        days < 0
          ? `Termin minął ${Math.abs(days)} dni temu.`
          : days === 0
            ? "Termin dziś."
            : `Termin za ${days} dni.`,
      href: "/finanse/terminy",
      amount: null,
      count: null,
    });
  }

  items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return items;
}
