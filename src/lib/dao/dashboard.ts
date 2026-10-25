import { createClient } from "@/lib/supabase/server";
import { getUserSettingsOrDefault } from "./user_settings";
import { pitFor, type TaxForm } from "@/lib/tax";
import { pitMonthlyDeadline, vatDeadline, zusDeadline } from "@/lib/taxDeadlines";
import { zusForMonth } from "@/lib/zus";

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
  // Nadwyżka VAT naliczonego nad należnym → do przeniesienia na następny okres lub zwrotu.
  vatToReclaim: number;
  // VAT naliczony z zakupów sfinansowanych dotacją — wchodzi do odliczenia,
  // ale wg umowy z PUP zwykle trzeba go oddać (nie jest „zyskiem").
  vatGrantInput: number;
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

// Rozbicie przychodu bieżącego miesiąca na zlecenia z fakturą i bez faktury.
// null, gdy tabela jobs nie ma jeszcze kolumny `invoiced` (stary schemat).
export type RevenueSplit = {
  invoicedNet: number;
  invoicedGross: number;
  invoicedCount: number;
  uninvoicedNet: number;
  uninvoicedGross: number;
  uninvoicedCount: number;
};

export type DashboardData = {
  ytd: PeriodTotals & { pit: number };
  month: PeriodTotals;
  vat: VatPeriodInfo | null;
  pit: PitMonthlyInfo;
  pendingRevenueGross: number;
  openDepositsTotal: number;
  uninvoicedMonth: UninvoicedSummary | null;
  monthRevenueSplit: RevenueSplit | null;
  monthlyTrend: MonthlyPoint[];
  costsByCategoryMonth: CategoryBreakdownRow[];
  reminders: ReminderItem[];
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
  category?: string | null;
  vat_deduction?: number | null;
  invoice?: { funded_by_grant?: boolean | null } | null;
};

// Zakup z dotacji (np. PUP) — wydatek sfinansowany zwolnioną z podatku dotacją
// nie jest kosztem uzyskania przychodu, więc nie liczy się do kosztów ani PIT.
const isGrantCost = (c: CostRow) => c.invoice?.funded_by_grant === true;

export type CategoryBreakdownRow = {
  category: string;
  amountNet: number;
  amountGross: number;
  share: number;
};

export type ReminderItem = {
  kind: "vat" | "pit" | "zus";
  label: string;
  periodLabel: string;
  deadline: string;
  daysUntil: number;
  amount: number | null;
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
  // VAT naliczony = tylko część podlegająca odliczeniu (100% / 50% / 0%).
  const factor = (c.vat_deduction ?? 100) / 100;
  totals.costsGross += gross;
  totals.costsVat += vat * factor;
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
      .in("status", ["installed", "settled", "archived"]),
    supabase
      .from("jobs")
      .select("amount_gross, vat_rate, status, paid_date, completed_date, deposit_amount, deposit_date")
      .not("status", "in", "(settled,archived,cancelled)")
      .not("deposit_date", "is", null)
      .gte("deposit_date", yearStart)
      .lte("deposit_date", yearEnd),
    selectCosts(supabase, yearStart, yearEnd),
  ]);

  let jobsData: unknown[] = jobsRes.data ?? [];
  if (jobsRes.error) {
    if (jobsRes.error.code === "42703") {
      const retry = await supabase
        .from("jobs")
        .select("amount_gross, vat_rate, status, paid_date, completed_date")
        .in("status", ["installed", "settled", "archived"]);
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
  const monthInvoiced = emptyTotals();
  const monthUninvoiced = emptyTotals();
  let monthInvoicedCount = 0;
  let monthUninvoicedCount = 0;
  const trend: PeriodTotals[] = Array.from({ length: 12 }, () => emptyTotals());
  // Podstawa PODATKOWA (PIT/ZUS) = tylko zlecenia z fakturą. Bez faktury = symulacja,
  // nie wchodzi do podatku. Gdy brak kolumny `invoiced` (stary schemat) — liczymy wszystko.
  const ytdTaxable = emptyTotals();
  const trendTaxable: PeriodTotals[] = Array.from({ length: 12 }, () => emptyTotals());

  let pendingRevenueGross = 0;

  for (const j of jobs) {
    if (j.status === "installed" && !j.paid_date) {
      pendingRevenueGross += toNum(j.amount_gross);
      continue;
    }
    const d = jobRevenueDate(j);
    if (!d) continue;
    const isTaxable = !hasInvoicedCol || j.invoiced === true;
    if (inRange(d, yearStart, yearEnd)) {
      addJobRevenue(ytd, j, settings.is_vat_payer);
      if (isTaxable) addJobRevenue(ytdTaxable, j, settings.is_vat_payer);
      const m = Number(d.slice(5, 7)) - 1;
      if (m >= 0 && m < 12) {
        addJobRevenue(trend[m], j, settings.is_vat_payer);
        if (isTaxable) addJobRevenue(trendTaxable[m], j, settings.is_vat_payer);
      }
    }
    if (inRange(d, monthStart, monthEnd)) {
      addJobRevenue(month, j, settings.is_vat_payer);
      if (hasInvoicedCol) {
        if (j.invoiced === true) {
          addJobRevenue(monthInvoiced, j, settings.is_vat_payer);
          monthInvoicedCount += 1;
        } else {
          addJobRevenue(monthUninvoiced, j, settings.is_vat_payer);
          monthUninvoicedCount += 1;
        }
      }
    }
  }

  const monthRevenueSplit: RevenueSplit | null = hasInvoicedCol
    ? {
        invoicedNet: monthInvoiced.revenueNet,
        invoicedGross: monthInvoiced.revenueGross,
        invoicedCount: monthInvoicedCount,
        uninvoicedNet: monthUninvoiced.revenueNet,
        uninvoicedGross: monthUninvoiced.revenueGross,
        uninvoicedCount: monthUninvoicedCount,
      }
    : null;

  const categoryAgg = new Map<string, { net: number; gross: number }>();
  for (const c of costs) {
    if (isGrantCost(c)) continue;
    addCost(ytd, c, settings.is_vat_payer);
    addCost(ytdTaxable, c, settings.is_vat_payer);
    const m = Number(c.cost_date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) {
      addCost(trend[m], c, settings.is_vat_payer);
      addCost(trendTaxable[m], c, settings.is_vat_payer);
    }
    if (inRange(c.cost_date, monthStart, monthEnd)) {
      addCost(month, c, settings.is_vat_payer);
      const key = (c.category && c.category.trim()) || "inne";
      const net = toNum(c.amount_net);
      const gross = toNum(c.amount_gross);
      const eff = settings.is_vat_payer ? net : gross;
      const cur = categoryAgg.get(key) ?? { net: 0, gross: 0 };
      cur.net += eff;
      cur.gross += gross;
      categoryAgg.set(key, cur);
    }
  }

  const totalCatNet = Array.from(categoryAgg.values()).reduce((a, v) => a + v.net, 0);
  const costsByCategoryMonth: CategoryBreakdownRow[] = Array.from(categoryAgg.entries())
    .map(([category, v]) => ({
      category,
      amountNet: v.net,
      amountGross: v.gross,
      share: totalCatNet > 0 ? v.net / totalCatNet : 0,
    }))
    .sort((a, b) => b.amountNet - a.amountNet);

  const monthlyTrend: MonthlyPoint[] = trend.map((t, i) => ({
    month: i,
    revenueNet: t.revenueNet,
    costsNet: t.costsNet,
    profit: t.revenueNet - t.costsNet,
  }));

  ytd.profit = ytd.revenueNet - ytd.costsNet;
  month.profit = month.revenueNet - month.costsNet;
  ytdTaxable.profit = ytdTaxable.revenueNet - ytdTaxable.costsNet;

  // Dochód podatkowy per miesiąc — tylko zlecenia z fakturą (bez symulacji bez-faktury).
  const taxableMonthlyProfit = trendTaxable.map((t) => t.revenueNet - t.costsNet);

  const pit = pitFor(settings.tax_form, Math.max(0, ytdTaxable.profit));

  const profitThroughEnd = taxableMonthlyProfit
    .slice(0, monthIdx + 1)
    .reduce((acc, p) => acc + p, 0);
  const profitThroughPrev = taxableMonthlyProfit
    .slice(0, monthIdx)
    .reduce((acc, p) => acc + p, 0);
  const pitThroughEnd = pitFor(settings.tax_form, Math.max(0, profitThroughEnd));
  const pitThroughPrev = pitFor(settings.tax_form, Math.max(0, profitThroughPrev));
  const pitMonth = Math.max(0, pitThroughEnd - pitThroughPrev);

  const pitDl = pitMonthlyDeadline(year, monthIdx);
  const pitInfo: PitMonthlyInfo = {
    monthLabel: `${MONTH_NAMES_PL[monthIdx]} ${year}`,
    pitMonth,
    pitYtd: pitThroughEnd,
    profitMonth: taxableMonthlyProfit[monthIdx] ?? 0,
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
      if (j.status === "installed" && !j.paid_date) continue;
      // Bez faktury = poza VAT (i tak sprzedaż paragonowa/symulacja) — nie do rejestru VAT.
      if (hasInvoicedCol && j.invoiced !== true) continue;
      const d = jobRevenueDate(j);
      if (inRange(d, from, to)) addJobRevenue(vatPeriod, j, true);
    }
    let vatGrantInput = 0;
    for (const c of costs) {
      if (!inRange(c.cost_date, from, to)) continue;
      addCost(vatPeriod, c, true);
      if (isGrantCost(c)) vatGrantInput += toNum(c.amount_vat) * ((c.vat_deduction ?? 100) / 100);
    }

    const vatDl = vatDeadline(year, monthIdx, settings.vat_period);
    const vatBalance = vatPeriod.revenueVat - vatPeriod.costsVat;
    vat = {
      from,
      to,
      label,
      vatDue: vatPeriod.revenueVat,
      vatInput: vatPeriod.costsVat,
      vatToPay: Math.max(0, vatBalance),
      vatToReclaim: Math.max(0, -vatBalance),
      vatGrantInput,
      deadline: isoDate(vatDl.due),
    };
  }

  const reminders: ReminderItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysFrom = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };
  if (vat) {
    reminders.push({
      kind: "vat",
      label: "VAT",
      periodLabel: vat.label,
      deadline: vat.deadline,
      daysUntil: daysFrom(vat.deadline),
      amount: vat.vatToPay,
    });
  }
  reminders.push({
    kind: "pit",
    label: "Zaliczka PIT",
    periodLabel: pitInfo.monthLabel,
    deadline: pitInfo.deadline,
    daysUntil: daysFrom(pitInfo.deadline),
    amount: pitInfo.pitMonth,
  });
  const zusDl = zusDeadline(year, monthIdx);
  const zusMonthProfit = taxableMonthlyProfit[monthIdx] ?? 0;
  const zusCalc = settings.zus_start_date
    ? zusForMonth({
        startDate: settings.zus_start_date,
        year,
        monthIdx,
        taxForm: settings.tax_form,
        monthIncome: zusMonthProfit,
        minHealth: settings.health_insurance_min,
      })
    : null;
  const zusAmount = zusCalc
    ? zusCalc.total
    : settings.zus_monthly && Number(settings.zus_monthly) > 0
      ? Number(settings.zus_monthly)
      : null;
  reminders.push({
    kind: "zus",
    label: "ZUS",
    periodLabel: `${MONTH_NAMES_PL[monthIdx]} ${year}`,
    deadline: isoDate(zusDl.due),
    daysUntil: daysFrom(isoDate(zusDl.due)),
    amount: zusAmount,
  });

  return {
    ytd: { ...ytd, pit },
    month,
    vat,
    pit: pitInfo,
    pendingRevenueGross,
    openDepositsTotal,
    uninvoicedMonth,
    monthRevenueSplit,
    monthlyTrend,
    costsByCategoryMonth,
    reminders,
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

// Koszty z flagą dotacji z faktury. Bez migracji 0050 (brak kolumny) — zapytanie
// bez flagi, żeby pulpit nie padł.
async function selectCosts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string
) {
  const base = "amount_net, amount_vat, amount_gross, cost_date, category, vat_deduction";
  const res = await supabase
    .from("cost_lines")
    .select(`${base}, invoice:invoices(funded_by_grant)`)
    .gte("cost_date", from)
    .lte("cost_date", to);
  if (!res.error) return res;
  return supabase.from("cost_lines").select(base).gte("cost_date", from).lte("cost_date", to);
}

export { MONTH_NAMES_PL };
