import PageHeader from "@/components/PageHeader";
import CalculatorForm from "./CalculatorForm";
import { listJobs } from "@/lib/dao/jobs";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { listQuoteTemplates } from "@/lib/dao/quote_templates";
import { getDashboardData } from "@/lib/dao/dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

export default async function CalculatorPage() {
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

  return (
    <main className="flex flex-1 flex-col px-6 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Kalkulator" back={{ href: "/" }} />
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
        />
      </div>
    </main>
  );
}
