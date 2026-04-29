import { createClient } from "@/lib/supabase/server";
import { getUserSettingsOrDefault } from "./user_settings";
import { pitFor, type TaxForm } from "@/lib/tax";
import { pitMonthlyDeadline, vatDeadline } from "@/lib/taxDeadlines";

export type PeriodTotals = {
  revenueNet: number;
  revenueVat: number;
  revenueGross: number;
  costsNet: number;
  costsVat: number;
  costsGross: number;
  profit: number;
};

export type VatPeriodInfo = {
  from: string;
  to: string;
  label: string;
  vatDue: number;
  vatInput: number;
  vatToPay: number;
  deadline: string;
};

export type PitMonthlyInfo = {
  monthLabel: string;
  pitMonth: number;
  pitYtd: number;
  profitMonth: number;
  profitYtd: number;
  deadline: string;
};

export type MonthlyPoint = {
  month: number;
  revenueNet: number;
  costsNet: number;
  profit: number;
};

export type UninvoicedSummary = {
  count: number;
  amountGross: number;
  amountNet: number;
  amountVat: number;
};

export type DashboardData = {
  ytd: PeriodTotals & { pit: number };
  month: PeriodTotals;
  vat: VatPeriodInfo | null;
  pit: PitMonthlyInfo;
  pendingRevenueGross: number;
  openDepositsTotal: number;
  uninvoicedMonth: UninvoicedSummary | null;
  monthlyTrend: MonthlyPoint[];
  settings: {
    tax_form: TaxForm;
    vat_period: "monthly" | "quarterly";
    is_vat_payer: boolean;
    zus_monthly: number | null;
  };
  year: number;
  month_index: number;
};

type JobRow = {
  amount_gross: string | number;
  vat_rate: string | number;
  status: string;
  paid_date: string | null;
  completed_date: string | null;
  deposit_amount?: string | number | null;
  deposit_date?: string | null;
  invoiced?: boolean | null;
};

type CostRow = {
  amount_net: string | number;
  amount_vat: string | number;
  amount_gross: string | number;
  cost_date: string;
};

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function jobRevenueDate(j: JobRow): string | null {
  return j.paid_date ?? j.completed_date ?? null;
}

function inRange(date: string | null, from: string, to: string): boolean {
  if (!date) return false;
  return date >= from && date <= to;
}

function emptyTotals(): PeriodTotals {
  return {
    revenueNet: 0,
    revenueVat: 0,
    revenueGross: 0,
    costsNet: 0,
    costsVat: 0,
    costsGross: 0,
    profit: 0,
  };
}

function addJobRevenue(
  totals: PeriodTotals,
  job: JobRow,
  isVatPayer: boolean
): void {
  const gross = toNum(job.amount_gross);
  const rate = toNum(job.vat_rate);
  const net = isVatPayer && rate > 0 ? gross / (1 + rate) : gross;
  const vat = isVatPayer ? gross - net : 0;
  totals.revenueGross += gross;
  totals.revenueNet += net;
  totals.revenueVat += vat;
}

function addCost(totals: PeriodTotals, c: CostRow, isVatPayer: boolean): void {
  const net = toNum(c.amount_net);
  const vat = toNum(c.amount_vat);
  const gross = toNum(c.amount_gross);
  totals.costsGross += gross;
  totals.costsVat += vat;
  totals.costsNet += isVatPayer ? net : gross;
}

function vatQuarter(monthIndex: number): { qStart: number; qEnd: number; label: string } {
  const q = Math.floor(monthIndex / 3);
  const qStart = q * 3;
  const qEnd = qStart + 2;
  const label = `Q${q + 1}`;
  return { qStart, qEnd, label };
}

const MONTH_NAMES_PL = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

export async function getDashboardData(now: Date = new Date()): Promise<DashboardData> {
  const supabase = await createClient();
  const settings = await getUserSettingsOrDefault();

  const year = now.getFullYear();
  const monthIdx = now.getMonth();

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const monthStart = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  const monthEndDate = new Date(year, monthIdx + 1, 0);
  const monthEnd = isoDate(monthEndDate);

  const [jobsRes, openJobsRes, costsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("amount_gross, vat_rate, status, paid_date, completed_date, invoiced")
      .in("status", ["paid", "completed"]),
    supabase
      .from("jobs")
      .select("amount_gross, vat_rate, status, paid_date, completed_date, deposit_amount, deposit_date")
      .not("status", "in", "(paid,completed,cancelled)")
      .not("deposit_date", "is", null)
      .gte("deposit_date", yearStart)
      .lte("deposit_date", yearEnd),
    supabase
      .from("cost_lines")
      .select("amount_net, amount_vat, amount_gross, cost_date")
      .gte("cost_date", yearStart)
      .lte("cost_date", yearEnd),
  ]);

  let jobsData: unknown[] = jobsRes.data ?? [];
  if (jobsRes.error) {
    if (jobsRes.error.code === "42703") {
      const retry = await supabase
        .from("jobs")
        .select("amount_gross, vat_rate, status, paid_date, completed_date")
        .in("status", ["paid", "completed"]);
      if (retry.error) throw retry.error;
      jobsData = retry.data ?? [];
    } else {
      throw jobsRes.error;
    }
  }
  if (costsRes.error) throw costsRes.error;

  const jobs = jobsData as JobRow[];
  const hasInvoicedCol = !jobsRes.error;
  const openDepositJobs =
    openJobsRes.error ? [] : ((openJobsRes.data ?? []) as JobRow[]);
  const costs = (costsRes.data ?? []) as CostRow[];

  if (openJobsRes.error && openJobsRes.error.code !== "42703") {
    throw openJobsRes.error;
  }

  const openDepositsTotal = openDepositJobs.reduce(
    (acc, j) => acc + toNum(j.deposit_amount ?? 0),
    0
  );

  const uninvoicedMonth: UninvoicedSummary | null = hasInvoicedCol
    ? jobs.reduce(
        (acc, j) => {
          if (j.invoiced === true) return acc;
          const d = jobRevenueDate(j);
          if (!inRange(d, monthStart, monthEnd)) return acc;
          const gross = toNum(j.amount_gross);
          const rate = toNum(j.vat_rate);
          const net = settings.is_vat_payer && rate > 0 ? gross / (1 + rate) : gross;
          const vat = settings.is_vat_payer ? gross - net : 0;
          return {
            count: acc.count + 1,
            amountGross: acc.amountGross + gross,
            amountNet: acc.amountNet + net,
            amountVat: acc.amountVat + vat,
          };
        },
        { count: 0, amountGross: 0, amountNet: 0, amountVat: 0 } as UninvoicedSummary
      )
    : null;

  const ytd = emptyTotals();
  const month = emptyTotals();
  const trend: PeriodTotals[] = Array.from({ length: 12 }, () => emptyTotals());

  let pendingRevenueGross = 0;

  for (const j of jobs) {
    if (j.status === "completed" && !j.paid_date) {
      pendingRevenueGross += toNum(j.amount_gross);
      continue;
    }
    const d = jobRevenueDate(j);
    if (!d) continue;
    if (inRange(d, yearStart, yearEnd)) {
      addJobRevenue(ytd, j, settings.is_vat_payer);
      const m = Number(d.slice(5, 7)) - 1;
      if (m >= 0 && m < 12) addJobRevenue(trend[m], j, settings.is_vat_payer);
    }
    if (inRange(d, monthStart, monthEnd)) addJobRevenue(month, j, settings.is_vat_payer);
  }

  for (const c of costs) {
    addCost(ytd, c, settings.is_vat_payer);
    const m = Number(c.cost_date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) addCost(trend[m], c, settings.is_vat_payer);
    if (inRange(c.cost_date, monthStart, monthEnd)) {
      addCost(month, c, settings.is_vat_payer);
    }
  }

  const monthlyTrend: MonthlyPoint[] = trend.map((t, i) => ({
    month: i,
    revenueNet: t.revenueNet,
    costsNet: t.costsNet,
    profit: t.revenueNet - t.costsNet,
  }));

  ytd.profit = ytd.revenueNet - ytd.costsNet;
  month.profit = month.revenueNet - month.costsNet;

  const pit = pitFor(settings.tax_form, Math.max(0, ytd.profit));

  const profitThroughEnd = monthlyTrend
    .slice(0, monthIdx + 1)
    .reduce((acc, p) => acc + p.profit, 0);
  const profitThroughPrev = monthlyTrend
    .slice(0, monthIdx)
    .reduce((acc, p) => acc + p.profit, 0);
  const pitThroughEnd = pitFor(settings.tax_form, Math.max(0, profitThroughEnd));
  const pitThroughPrev = pitFor(settings.tax_form, Math.max(0, profitThroughPrev));
  const pitMonth = Math.max(0, pitThroughEnd - pitThroughPrev);

  const pitDl = pitMonthlyDeadline(year, monthIdx);
  const pitInfo: PitMonthlyInfo = {
    monthLabel: `${MONTH_NAMES_PL[monthIdx]} ${year}`,
    pitMonth,
    pitYtd: pitThroughEnd,
    profitMonth: monthlyTrend[monthIdx]?.profit ?? 0,
    profitYtd: profitThroughEnd,
    deadline: isoDate(pitDl.due),
  };

  let vat: VatPeriodInfo | null = null;
  if (settings.is_vat_payer) {
    let from: string;
    let to: string;
    let label: string;
    if (settings.vat_period === "quarterly") {
      const { qStart, qEnd, label: qLabel } = vatQuarter(monthIdx);
      from = `${year}-${String(qStart + 1).padStart(2, "0")}-01`;
      const qEndDate = new Date(year, qEnd + 1, 0);
      to = isoDate(qEndDate);
      label = `${qLabel} ${year}`;
    } else {
      from = monthStart;
      to = monthEnd;
      label = `${MONTH_NAMES_PL[monthIdx]} ${year}`;
    }

    const vatPeriod = emptyTotals();
    for (const j of jobs) {
      if (j.status === "completed" && !j.paid_date) continue;
      const d = jobRevenueDate(j);
      if (inRange(d, from, to)) addJobRevenue(vatPeriod, j, true);
    }
    for (const c of costs) {
      if (inRange(c.cost_date, from, to)) addCost(vatPeriod, c, true);
    }

    const vatDl = vatDeadline(year, monthIdx, settings.vat_period);
    vat = {
      from,
      to,
      label,
      vatDue: vatPeriod.revenueVat,
      vatInput: vatPeriod.costsVat,
      vatToPay: Math.max(0, vatPeriod.revenueVat - vatPeriod.costsVat),
      deadline: isoDate(vatDl.due),
    };
  }

  return {
    ytd: { ...ytd, pit },
    month,
    vat,
    pit: pitInfo,
    pendingRevenueGross,
    openDepositsTotal,
    uninvoicedMonth,
    monthlyTrend,
    settings: {
      tax_form: settings.tax_form,
      vat_period: settings.vat_period,
      is_vat_payer: settings.is_vat_payer,
      zus_monthly: settings.zus_monthly,
    },
    year,
    month_index: monthIdx,
  };
}

export { MONTH_NAMES_PL };
