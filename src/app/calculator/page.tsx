import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import CalculatorForm from "./CalculatorForm";
import { listJobs } from "@/lib/dao/jobs";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { listQuoteTemplates } from "@/lib/dao/quote_templates";
import { getDashboardData } from "@/lib/dao/dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kalkulator" };

async function getJobCostSummaries(): Promise<Map<string, { net: number; vat: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_lines")
    .select("job_id, amount_net, amount_vat")
    .not("job_id", "is", null);
  if (error) throw error;

  const map = new Map<string, { net: number; vat: number }>();
  for (const row of (data ?? []) as { job_id: string; amount_net: string; amount_vat: string }[]) {
    const cur = map.get(row.job_id) ?? { net: 0, vat: 0 };
    cur.net += Number(row.amount_net) || 0;
    cur.vat += Number(row.amount_vat) || 0;
    map.set(row.job_id, cur);
  }
  return map;
}

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job: jobParam } = await searchParams;
  const initialJobId = typeof jobParam === "string" && jobParam ? jobParam : undefined;

  const [jobs, settings, costSummaries, templates, dashboard] = await Promise.all([
    listJobs(),
    getUserSettingsOrDefault(),
    getJobCostSummaries(),
    listQuoteTemplates(),
    getDashboardData(),
  ]);

  const jobOptions = jobs.map((j) => {
    const c = costSummaries.get(j.id);
    return {
      id: j.id,
      title: j.title,
      client_name: j.client_name,
      costs_net: c?.net ?? 0,
      costs_vat: c?.vat ?? 0,
    };
  });

  const presetJob = initialJobId
    ? jobOptions.find((j) => j.id === initialJobId)
    : undefined;

  const backHref = presetJob ? `/jobs/${presetJob.id}` : "/";

  return (
    <main className="flex flex-1 flex-col px-6 py-6">
      <div className="w-full max-w-md sm:max-w-2xl mx-auto">
        <PageHeader title="Kalkulator" back={{ href: backHref }} />
        {presetJob && (
          <div className="mb-3 rounded-xl border border-[#ebe8e3] bg-[#faf5e9] px-3.5 py-2.5 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[#9c9081]">
                Wycena dla zlecenia
              </p>
              <p className="text-sm font-medium text-[#282624] truncate">
                {presetJob.title}
              </p>
              <p className="text-[11px] text-[#6b6661] truncate">
                {presetJob.client_name}
              </p>
            </div>
            <Link
              href={`/jobs/${presetJob.id}`}
              className="shrink-0 text-[11px] font-medium text-[#57534e] underline-offset-2 hover:underline"
            >
              ← do zlecenia
            </Link>
          </div>
        )}
        <CalculatorForm
          jobs={jobOptions}
          defaultTaxForm={settings.tax_form}
          defaultVatRate={settings.default_vat_rate}
          defaultIsVatPayer={settings.is_vat_payer}
          defaultYearIncome={Math.max(0, dashboard.pit.profitYtd)}
          templates={templates}
          materialCategories={settings.material_categories}
          defaultZusPelny={settings.zus_pelny ?? 1900}
          defaultZusMaly={settings.zus_maly ?? 891.34}
          defaultZusUlga={settings.zus_ulga ?? 397.16}
          initialJobId={initialJobId}
        />
      </div>
    </main>
  );
}
