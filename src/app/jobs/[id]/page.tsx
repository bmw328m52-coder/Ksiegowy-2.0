import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getJob, JOB_STATUS_LABELS } from "@/lib/dao/jobs";
import { listCostLinesByJob } from "@/lib/dao/cost_lines";
import { listChecklistByJob } from "@/lib/dao/job_checklist";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { getDashboardData } from "@/lib/dao/dashboard";
import {
  getActiveTimer,
  listEntriesByJob,
  sumByPhase,
} from "@/lib/dao/time_entries";
import { computeJobMargin } from "@/lib/jobMargin";
import { pitFor } from "@/lib/tax";
import { fmtPLN, fmtDate, fmtMinutes } from "@/lib/format";
import { deleteJobAction, markJobPaidAction } from "../actions";
import TimeTracker from "./TimeTracker";
import JobChecklist from "./JobChecklist";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  return { title: job?.title ?? "Zlecenie" };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  const [costLines, settings, timeEntries, activeTimer, dashboard, checklist] = await Promise.all([
    listCostLinesByJob(id),
    getUserSettingsOrDefault(),
    listEntriesByJob(id),
    getActiveTimer(),
    getDashboardData(),
    listChecklistByJob(id),
  ]);
  const margin = computeJobMargin(job, costLines, settings.is_vat_payer);
  const phaseSums = sumByPhase(timeEntries);

  const totalMin = timeEntries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const totalHours = totalMin / 60;
  const profitForTaxes = Math.max(0, margin.profit);
  // YTD nie wlicza tego zlecenia, jeśli jeszcze nie opłacone — odejmujemy żeby uniknąć podwójnego liczenia
  const baselineYearIncome = Math.max(
    0,
    dashboard.pit.profitYtd - (job.status === "paid" ? profitForTaxes : 0)
  );
  const pitForJob =
    pitFor(settings.tax_form, baselineYearIncome + profitForTaxes) -
    pitFor(settings.tax_form, baselineYearIncome);
  const zusMonthly = Number(settings.zus_pelny ?? 0);
  const hoursPerMonth = 160;
  const zusForJob = (zusMonthly / hoursPerMonth) * totalHours;
  const netCashAfterTax = margin.profit - pitForJob - zusForJob;
  const ratePerHour = totalHours > 0 ? netCashAfterTax / totalHours : 0;

  const vatPct = Math.round(Number(job.vat_rate) * 100);
  const gross = Number(job.amount_gross);
  const net = vatPct > 0 ? gross / (1 + Number(job.vat_rate)) : gross;
  const vat = gross - net;
  const deposit = Number(job.deposit_amount ?? 0);
  const balanceDue = Math.max(0, gross - deposit);

  const deleteWithIds = deleteJobAction.bind(null, id, job.client_id);
  const markPaid = markJobPaidAction.bind(null, id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader
          title={job.title}
          back={{ href: `/clients/${job.client_id}` }}
          action={
            <Link
              href={`/jobs/${id}/edit`}
              className="text-sm text-zinc-600 underline-offset-2 hover:underline"
            >
              Edytuj
            </Link>
          }
        />

        <section className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Klient</span>
            <Link
              href={`/clients/${job.client_id}`}
              className="text-sm font-medium underline-offset-2 hover:underline"
            >
              {job.client_name}
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Status</span>
            <span className="text-sm font-medium">{JOB_STATUS_LABELS[job.status]}</span>
          </div>

          <div className="border-t border-zinc-100 pt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-zinc-500">Netto</p>
              <p className="text-sm font-medium">{fmtPLN(net)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">VAT {vatPct}%</p>
              <p className="text-sm font-medium">{fmtPLN(vat)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Brutto</p>
              <p className="text-base font-semibold">{fmtPLN(gross)}</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-zinc-700">Marża zlecenia</h2>
            <span className="text-[11px] text-zinc-500">
              {margin.costsCount} {margin.costsCount === 1 ? "pozycja" : margin.costsCount > 1 && margin.costsCount < 5 ? "pozycje" : "pozycji"} kosztu
            </span>
          </div>
          <Row label="Przychód netto" value={fmtPLN(margin.revenueNet)} />
          <Row label="Koszty przypisane" value={`− ${fmtPLN(margin.costsNet)}`} />
          <div className="border-t border-zinc-100 pt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-zinc-900">Zysk</span>
            <span className="flex items-baseline gap-2">
              <span
                className={`text-base font-semibold tabular-nums ${
                  margin.profit >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {fmtPLN(margin.profit)}
              </span>
              {margin.marginPct !== null && (
                <span
                  className={`text-xs tabular-nums ${
                    margin.profit >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {margin.profit >= 0 ? "+" : ""}
                  {margin.marginPct.toFixed(1)}%
                </span>
              )}
            </span>
          </div>
          {margin.costsCount === 0 && (
            <p className="text-[11px] text-zinc-500 pt-1">
              Przypisz pozycje z faktur kosztowych do tego zlecenia, aby śledzić rzeczywistą marżę.
            </p>
          )}
        </section>

        <JobChecklist jobId={id} projectType={job.project_type} items={checklist} />

        <TimeTracker
          jobId={id}
          entries={timeEntries}
          active={activeTimer}
          phaseSums={phaseSums}
        />

        {totalMin > 0 && (
          <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-700">Rzeczywista stawka</h2>
              <span className="text-[11px] text-zinc-500">
                {fmtMinutes(totalMin)} ({totalHours.toFixed(2).replace(".", ",")} h)
              </span>
            </div>

            <div
              className={`rounded-xl border p-3 ${
                ratePerHour >= 0 ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
              }`}
            >
              <p
                className={`text-[11px] uppercase tracking-wide font-semibold ${
                  ratePerHour >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                Na rękę / godzinę
              </p>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  ratePerHour >= 0 ? "text-emerald-900" : "text-red-900"
                }`}
              >
                {fmtPLN(ratePerHour)}
              </p>
              <p
                className={`text-[11px] mt-0.5 ${
                  ratePerHour >= 0 ? "text-emerald-700/80" : "text-red-700/80"
                }`}
              >
                po PIT i ZUS proporcjonalnym
              </p>
            </div>

            <div className="text-xs space-y-1.5 pt-1">
              <Row label="Zysk netto (przychód − koszty)" value={fmtPLN(margin.profit)} />
              <Row
                label={`PIT (${settings.tax_form === "skala" ? "skala" : "liniowy"}, przyrost roczny)`}
                value={`− ${fmtPLN(pitForJob)}`}
              />
              <Row
                label={`ZUS proporcjonalny (${fmtPLN(zusMonthly)}/mies. × ${totalHours.toFixed(1).replace(".", ",")}h ÷ ${hoursPerMonth}h)`}
                value={`− ${fmtPLN(zusForJob)}`}
              />
              <div className="border-t border-zinc-100 pt-1.5 flex items-center justify-between">
                <span className="text-zinc-900 font-medium">Na rękę</span>
                <span
                  className={`font-semibold tabular-nums ${
                    netCashAfterTax >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {fmtPLN(netCashAfterTax)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 pt-1">
              PIT jako przyrost względem dochodu YTD (uwzględnia kwotę wolną i progi). VAT
              pomija się — pass-through dla VATowca.
            </p>
          </section>
        )}

        {deposit > 0 && (
          <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm space-y-2">
            <Row label="Zaliczka / zadatek" value={fmtPLN(deposit)} />
            {job.deposit_date && (
              <Row label="Data zaliczki" value={fmtDate(job.deposit_date)} />
            )}
            <div className="border-t border-zinc-100 pt-2">
              <Row label="Pozostało do zapłaty" value={fmtPLN(balanceDue)} />
            </div>
          </section>
        )}

        <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm space-y-2">
          {job.start_date && (
            <Row label="Data startu" value={fmtDate(job.start_date)} />
          )}
          {job.due_date && <Row label="Termin" value={fmtDate(job.due_date)} />}
          {job.completed_date && (
            <Row label="Zakończono" value={fmtDate(job.completed_date)} />
          )}
          {job.paid_date && <Row label="Zapłacono" value={fmtDate(job.paid_date)} />}
          {!job.start_date && !job.due_date && !job.completed_date && !job.paid_date && (
            <p className="text-zinc-400 text-center">Brak ustawionych dat.</p>
          )}
          {job.notes && (
            <p className="whitespace-pre-wrap pt-2 border-t border-zinc-100 text-zinc-700">
              {job.notes}
            </p>
          )}
        </section>

        {job.status !== "paid" && (
          <form action={markPaid} className="mt-4">
            <button
              type="submit"
              className="w-full rounded-lg bg-green-600 text-white py-3 font-medium active:opacity-80"
            >
              Oznacz jako opłacone
            </button>
          </form>
        )}

        <form action={deleteWithIds} className="mt-10">
          <ConfirmSubmitButton
            message="Na pewno usunąć to zlecenie? Tej operacji nie da się cofnąć."
            formNoValidate
            className="w-full text-sm text-red-600 py-3 active:underline"
          >
            Usuń zlecenie
          </ConfirmSubmitButton>
        </form>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
