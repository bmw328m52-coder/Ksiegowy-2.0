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
