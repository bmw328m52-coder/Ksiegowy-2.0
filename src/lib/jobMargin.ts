import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/dao/jobs.types";

export type JobMargin = {
  revenueNet: number;
  revenueGross: number;
  costsNet: number;
  costsGross: number;
  profit: number;
  marginPct: number | null;
  costsCount: number;
};

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

type CostLineLike = {
  amount_net: string | number;
  amount_gross: string | number;
};

export function computeJobMargin(
  job: Pick<Job, "amount_gross" | "vat_rate">,
  lines: CostLineLike[],
  isVatPayer: boolean,
): JobMargin {
  const gross = toNum(job.amount_gross);
  const rate = toNum(job.vat_rate);
  const revenueNet = isVatPayer && rate > 0 ? gross / (1 + rate) : gross;

  let costsNet = 0;
  let costsGross = 0;
  for (const l of lines) {
    const n = toNum(l.amount_net);
    const g = toNum(l.amount_gross);
    costsGross += g;
    costsNet += isVatPayer ? n : g;
  }

  const profit = revenueNet - costsNet;
  const marginPct = revenueNet > 0 ? (profit / revenueNet) * 100 : null;

  return {
    revenueNet,
    revenueGross: gross,
    costsNet,
    costsGross,
    profit,
    marginPct,
    costsCount: lines.length,
  };
}

type JobMaterialLike = {
  qty: number;
  unit_price_gross: number | null;
};

// Koszt materiałów z wyceny (suma qty × cena brutto z pozycji job_materials).
export function sumMaterialCostGross(materials: JobMaterialLike[]): number {
  let g = 0;
  for (const m of materials) {
    g += toNum(m.qty) * toNum(m.unit_price_gross);
  }
  return g;
}

export type JobMarginFull = {
  revenueNet: number;
  revenueGross: number;
  // Szacunek z wyceny (materiały). Dostępny od razu, gdy zlecenie ma wycenę.
  materialCostNet: number;
  materialCostGross: number;
  materialCount: number;
  estProfit: number;
  estMarginPct: number | null;
  // Realne koszty z faktur kosztowych (cost_lines). Wypełnia się, gdy przypniesz faktury.
  invoiceCostsNet: number;
  invoiceCostsGross: number;
  invoiceCount: number;
  realProfit: number;
  realMarginPct: number | null;
};

// Pełna rentowność: przychód z wartości zlecenia, koszty z DWÓCH źródeł — wyceny (szacunek)
// i faktur kosztowych (realne). VAT-owiec: kwoty netto (przychód i materiały odliczane TĄ SAMĄ
// stawką VAT zlecenia, żeby były spójne); nie-VAT-owiec lub VAT 0%: wszystko brutto.
export function computeJobMarginFull(
  job: Pick<Job, "amount_gross" | "vat_rate">,
  costLines: CostLineLike[],
  materials: JobMaterialLike[],
  isVatPayer: boolean,
): JobMarginFull {
  const gross = toNum(job.amount_gross);
  const rate = toNum(job.vat_rate);
  const net = (g: number) => (isVatPayer && rate > 0 ? g / (1 + rate) : g);
  const revenueNet = net(gross);

  const materialCostGross = sumMaterialCostGross(materials);
  const materialCostNet = net(materialCostGross);

  let invoiceCostsNet = 0;
  let invoiceCostsGross = 0;
  for (const l of costLines) {
    const n = toNum(l.amount_net);
    const g = toNum(l.amount_gross);
    invoiceCostsGross += g;
    invoiceCostsNet += isVatPayer ? n : g;
  }

  const estProfit = revenueNet - materialCostNet;
  const realProfit = revenueNet - invoiceCostsNet;

  return {
    revenueNet,
    revenueGross: gross,
    materialCostNet,
    materialCostGross,
    materialCount: materials.length,
    estProfit,
    estMarginPct: revenueNet > 0 ? (estProfit / revenueNet) * 100 : null,
    invoiceCostsNet,
    invoiceCostsGross,
    invoiceCount: costLines.length,
    realProfit,
    realMarginPct: revenueNet > 0 ? (realProfit / revenueNet) * 100 : null,
  };
}

export async function getJobMarginsMap(
  jobIds: string[],
): Promise<Map<string, { costsNet: number; costsGross: number; count: number }>> {
  const out = new Map<string, { costsNet: number; costsGross: number; count: number }>();
  if (jobIds.length === 0) return out;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_lines")
    .select("job_id, amount_net, amount_gross")
    .in("job_id", jobIds);
  if (error) throw error;

  for (const r of (data ?? []) as {
    job_id: string;
    amount_net: string | number;
    amount_gross: string | number;
  }[]) {
    const cur = out.get(r.job_id) ?? { costsNet: 0, costsGross: 0, count: 0 };
    cur.costsNet += toNum(r.amount_net);
    cur.costsGross += toNum(r.amount_gross);
    cur.count += 1;
    out.set(r.job_id, cur);
  }

  return out;
}
