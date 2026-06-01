import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getClient } from "@/lib/dao/clients";
import { listJobsByClient, JOB_STATUS_LABELS } from "@/lib/dao/jobs";
import { listMaterialCostsByClient } from "@/lib/dao/cost_lines";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { computeJobMargin, getJobMarginsMap } from "@/lib/jobMargin";
import { effectiveJobStatus } from "@/lib/jobStatus";
import { fmtPLN, fmtDate } from "@/lib/format";
import { deleteClientAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  return { title: client?.name ?? "Klient" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, jobs, materials, settings] = await Promise.all([
    getClient(id),
    listJobsByClient(id),
    listMaterialCostsByClient(id),
    getUserSettingsOrDefault(),
  ]);
  if (!client) notFound();

  const totalGross = jobs.reduce((acc, j) => acc + Number(j.amount_gross), 0);
  const paidGross = jobs
    .filter((j) => j.status === "settled" || j.status === "archived")
    .reduce((acc, j) => acc + Number(j.amount_gross), 0);

  const materialsTotalGross = materials.reduce(
    (acc, m) => acc + Number(m.amount_gross),
    0
  );

  const billableJobs = jobs.filter((j) => j.status !== "cancelled");
  const costsByJob = await getJobMarginsMap(billableJobs.map((j) => j.id));

  let revenueNetSum = 0;
  let costsNetSum = 0;
  const marginByJob = new Map<string, { profit: number; marginPct: number | null }>();
  for (const j of billableJobs) {
    const c = costsByJob.get(j.id);
    const fakeLines = c
      ? [{ amount_net: c.costsNet, amount_gross: c.costsGross }]
      : [];
    const m = computeJobMargin(j, fakeLines, settings.is_vat_payer);
    revenueNetSum += m.revenueNet;
    costsNetSum += m.costsNet;
    marginByJob.set(j.id, { profit: m.profit, marginPct: m.marginPct });
  }
  const profitSum = revenueNetSum - costsNetSum;
  const marginPctSum = revenueNetSum > 0 ? (profitSum / revenueNetSum) * 100 : null;

  const deleteWithId = deleteClientAction.bind(null, id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader
          title={client.name}
          back={{ href: "/clients" }}
          action={
            <Link
              href={`/clients/${id}/edit`}
              className="text-sm text-zinc-600 underline-offset-2 hover:underline"
            >
              Edytuj
            </Link>
          }
        />

        <section className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2 text-sm">
          <p>
            <span className="text-zinc-500">Typ: </span>
            {client.type === "company" ? "Firma" : "Osoba prywatna"}
          </p>
          {client.nip && (
            <p>
              <span className="text-zinc-500">NIP: </span>
              {client.nip}
            </p>
          )}
          {client.address && (
            <p>
              <span className="text-zinc-500">Adres: </span>
              {client.address}
            </p>
          )}
          {client.email && (
            <p>
              <span className="text-zinc-500">E-mail: </span>
              <a href={`mailto:${client.email}`} className="underline-offset-2 hover:underline">
                {client.email}
              </a>
            </p>
          )}
          {client.phone && (
            <p>
              <span className="text-zinc-500">Telefon: </span>
              <a href={`tel:${client.phone}`} className="underline-offset-2 hover:underline">
                {client.phone}
              </a>
            </p>
          )}
          {client.notes && <p className="whitespace-pre-wrap text-zinc-700 pt-2">{client.notes}</p>}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Pomiary</h2>
            <Link
              href={`/jobs/new?clientId=${id}`}
              className="rounded-lg bg-accent text-white px-3 py-1.5 text-sm font-medium active:opacity-80"
            >
              + Nowy pomiar
            </Link>
          </div>

          {jobs.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2">
                  <p className="text-zinc-500">Suma zleceń (brutto)</p>
                  <p className="font-medium text-sm tabular-nums">{fmtPLN(totalGross)}</p>
                </div>
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2">
                  <p className="text-zinc-500">Opłacone</p>
                  <p className="font-medium text-sm tabular-nums">{fmtPLN(paidGross)}</p>
                </div>
              </div>
              {billableJobs.length > 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-3 mb-3">
                  <p className="text-xs text-zinc-500 mb-2">
                    Marża {settings.is_vat_payer ? "(netto)" : "(brutto, bez VAT)"}
                    {jobs.length !== billableJobs.length && " · pomija anulowane"}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-zinc-500">Przychód</p>
                      <p className="font-medium text-sm tabular-nums">{fmtPLN(revenueNetSum)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Koszty zleceń</p>
                      <p className="font-medium text-sm tabular-nums">{fmtPLN(costsNetSum)}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-zinc-100 flex items-baseline justify-between">
                    <div>
                      <p className="text-zinc-500 text-xs">Zysk</p>
                      <p
                        className={`font-semibold text-base tabular-nums ${
                          profitSum >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {fmtPLN(profitSum)}
                      </p>
                    </div>
                    {marginPctSum !== null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          marginPctSum >= 20
                            ? "bg-green-100 text-green-700"
                            : marginPctSum >= 0
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {marginPctSum.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {jobs.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-6">Brak zleceń.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {jobs.map((j) => {
                const m = marginByJob.get(j.id);
                return (
                  <li key={j.id}>
                    <Link
                      href={`/jobs/${j.id}`}
                      className="block rounded-xl border border-zinc-200 bg-white p-3 active:bg-zinc-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{j.title}</p>
                          <p className="text-xs text-zinc-500">
                            {fmtPLN(j.amount_gross)} • {fmtDate(j.due_date ?? j.start_date)}
                          </p>
                        </div>
                        <StatusBadge status={effectiveJobStatus(j)} />
                      </div>
                      {m && (
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span
                            className={`tabular-nums ${
                              m.profit >= 0 ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            zysk {fmtPLN(m.profit)}
                          </span>
                          {m.marginPct !== null && (
                            <span className="text-zinc-500 tabular-nums">
                              · {m.marginPct.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Zakupy materiałów</h2>
            {materials.length > 0 && (
              <span className="text-sm font-medium tabular-nums">
                {fmtPLN(materialsTotalGross)}
              </span>
            )}
          </div>

          {materials.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-6">
              Brak zakupów materiałów. Dodawane są przez fakturę kosztową przypisaną do zlecenia z kategorią „materiały”.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {materials.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{m.description}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {fmtDate(m.cost_date)}
                        {m.job_title && ` · ${m.job_title}`}
                        {m.invoice_supplier && ` · ${m.invoice_supplier}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium tabular-nums">{fmtPLN(m.amount_gross)}</p>
                      <p className="text-[11px] text-zinc-500 tabular-nums">
                        netto {fmtPLN(m.amount_net)}
                      </p>
                    </div>
                  </div>
                  {m.invoice_id && (
                    <Link
                      href={`/invoices/${m.invoice_id}`}
                      className="text-xs text-zinc-600 underline-offset-2 hover:underline mt-1 inline-block"
                    >
                      Zobacz fakturę
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <form action={deleteWithId} className="mt-10">
          <ConfirmSubmitButton
            message={
              jobs.length > 0
                ? `Klient ma ${jobs.length} ${plJobs(jobs.length)}. Razem z klientem zostaną trwale usunięte wszystkie zlecenia (z czasem pracy i checklistami). Koszty z faktur zostaną zachowane jako koszty ogólne. Kontynuować?`
                : "Na pewno usunąć tego klienta?"
            }
            formNoValidate
            className="w-full text-sm text-red-600 py-3 active:underline"
          >
            Usuń klienta
          </ConfirmSubmitButton>
        </form>
      </div>
    </main>
  );
}

function plJobs(n: number): string {
  if (n === 1) return "zlecenie";
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return "zleceń";
  if (last >= 2 && last <= 4) return "zlecenia";
  return "zleceń";
}

function StatusBadge({ status }: { status: keyof typeof JOB_STATUS_LABELS }) {
  const colors: Record<string, string> = {
    new_inquiry: "bg-[#f5f3ef] text-[#9c9081]",
    scheduled_measurement: "bg-[#f1e5d2] text-[#7d5530]",
    to_measure: "bg-[#f1e5d2] text-[#7d5530]",
    after_measure: "bg-[#f1e5d2] text-[#7d5530]",
    to_quote: "bg-[#faf5e9] text-[#a18653]",
    quote_sent: "bg-[#faf5e9] text-[#a18653]",
    accepted: "bg-[#dde5ef] text-[#5a7898]",
    materials_ordered: "bg-[#dde5ef] text-[#5a7898]",
    in_production: "bg-[#dde5ef] text-[#5a7898]",
    ready_to_install: "bg-[#e3efe5] text-[#4f8a64]",
    installed: "bg-[#e3efe5] text-[#4f8a64]",
    settled: "bg-[#e3efe5] text-[#3a6b4d]",
    archived: "bg-[#f5f3ef] text-[#9c9081]",
    cancelled: "bg-[#f5f3ef] text-[#9c9081] line-through",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${colors[status]}`}>
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
