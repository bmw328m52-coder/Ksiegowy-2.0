import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getJob, JOB_STATUS_LABELS } from "@/lib/dao/jobs";
import { listCostLinesByJob } from "@/lib/dao/cost_lines";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { computeJobMargin } from "@/lib/jobMargin";
import { fmtPLN, fmtDate } from "@/lib/format";
import { deleteJobAction, markJobPaidAction } from "../actions";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  const [costLines, settings] = await Promise.all([
    listCostLinesByJob(id),
    getUserSettingsOrDefault(),
  ]);
  const margin = computeJobMargin(job, costLines, settings.is_vat_payer);

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
          <button
            type="submit"
            className="w-full text-sm text-red-600 py-3 active:underline"
            formNoValidate
          >
            Usuń zlecenie
          </button>
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
