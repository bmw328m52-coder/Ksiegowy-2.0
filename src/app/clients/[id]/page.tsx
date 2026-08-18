import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getClient } from "@/lib/dao/clients";
import { listJobsByClient } from "@/lib/dao/jobs";
import { jobCountsForProfitability } from "@/lib/dao/jobs.types";
import { listMaterialCostsByClient } from "@/lib/dao/cost_lines";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { getJobMarginsMap } from "@/lib/jobMargin";
import { getJobMaterialGrossMap } from "@/lib/dao/material_catalog";
import { effectiveJobStatus } from "@/lib/jobStatus";
import { jobStatusLabel, jobStatusTone } from "@/lib/jobStatusView";
import { fmtPLN, fmtDate } from "@/lib/format";
import { deleteClientAction } from "../actions";
import {
  PageContainer,
  Card,
  SectionHeading,
  StatCard,
  Badge,
  EmptyState,
  ButtonLink,
} from "@/components/ui";

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

  // Do marży wliczamy zlecenia dopiero od etapu „Materiały zamówione" — wcześniejsze
  // (wycena/akceptacja) to oferta, nie realny wynik klienta (spójnie z /finanse/rentownosc).
  const billableJobs = jobs.filter((j) => jobCountsForProfitability(j.status));
  const jobIds = billableJobs.map((j) => j.id);
  // Koszty z DWÓCH źródeł: faktury kosztowe (cost_lines) jeśli są, w przeciwnym razie
  // szacunek z wyceny (job_materials). Bez tego karta klienta pokazywała zysk = cała
  // kwota, bo Artur wycenia w wycenie, a nie podpina faktur kosztowych.
  const [costsByJob, materialGrossByJob] = await Promise.all([
    getJobMarginsMap(jobIds),
    getJobMaterialGrossMap(jobIds),
  ]);

  let revenueNetSum = 0;
  let costsNetSum = 0;
  const marginByJob = new Map<
    string,
    { profit: number; marginPct: number | null; costsNet: number; fromInvoices: boolean }
  >();
  for (const j of billableJobs) {
    const rate = Number(j.vat_rate);
    const vatApplies = settings.is_vat_payer && rate > 0;
    const toNet = (g: number) => (vatApplies ? g / (1 + rate) : g);

    const revenueNet = toNet(Number(j.amount_gross));

    const inv = costsByJob.get(j.id);
    const fromInvoices = (inv?.count ?? 0) > 0;
    const costsNet = fromInvoices
      ? settings.is_vat_payer
        ? inv!.costsNet
        : inv!.costsGross
      : toNet(materialGrossByJob.get(j.id) ?? 0);

    const profit = revenueNet - costsNet;
    const marginPct = revenueNet > 0 ? (profit / revenueNet) * 100 : null;

    revenueNetSum += revenueNet;
    costsNetSum += costsNet;
    marginByJob.set(j.id, { profit, marginPct, costsNet, fromInvoices });
  }
  const profitSum = revenueNetSum - costsNetSum;
  const marginPctSum = revenueNetSum > 0 ? (profitSum / revenueNetSum) * 100 : null;
  const marginTone =
    marginPctSum === null ? "neutral" : marginPctSum >= 20 ? "ok" : marginPctSum >= 0 ? "accent" : "warn";

  const deleteWithId = deleteClientAction.bind(null, id);

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={client.name}
        back={{ href: "/clients" }}
        action={
          <ButtonLink href={`/clients/${id}/edit`} variant="secondary" size="sm">
            Edytuj
          </ButtonLink>
        }
      />

      {/* Dane kontaktowe */}
      <Card className="space-y-2 text-sm">
        <p>
          <span className="text-[#8d8a85]">Typ: </span>
          {client.type === "company" ? "Firma" : "Osoba prywatna"}
        </p>
        {client.nip && (
          <p>
            <span className="text-[#8d8a85]">NIP: </span>
            {client.nip}
          </p>
        )}
        {client.address && (
          <p>
            <span className="text-[#8d8a85]">Adres: </span>
            {client.address}
          </p>
        )}
        {client.email && (
          <p>
            <span className="text-[#8d8a85]">E-mail: </span>
            <a href={`mailto:${client.email}`} className="text-[#a06f3f] underline-offset-2 hover:underline">
              {client.email}
            </a>
          </p>
        )}
        {client.phone && (
          <p>
            <span className="text-[#8d8a85]">Telefon: </span>
            <a href={`tel:${client.phone}`} className="text-[#a06f3f] underline-offset-2 hover:underline">
              {client.phone}
            </a>
          </p>
        )}
        {client.notes && <p className="whitespace-pre-wrap text-[#4a4843] pt-2">{client.notes}</p>}
      </Card>

      {/* Pomiary / zlecenia */}
      <section>
        <SectionHeading>Pomiary i zlecenia</SectionHeading>

        {jobs.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <StatCard label="Suma zleceń" value={fmtPLN(totalGross)} tone="neutral" money />
            <StatCard label="Opłacone" value={fmtPLN(paidGross)} tone="ok" money />
          </div>
        )}

        {billableJobs.length > 0 && (
          <Card className="mb-2.5">
            <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[#9ea29c] mb-2">
              Marża {settings.is_vat_payer ? "(netto)" : "(brutto, bez VAT)"}
              {jobs.length !== billableJobs.length && " · od zamówienia materiałów"}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[#8d8a85]">Przychód</p>
                <p className="font-semibold text-sm tabular-nums text-[#1f1d1b]">{fmtPLN(revenueNetSum)}</p>
              </div>
              <div>
                <p className="text-[#8d8a85]">Koszty zleceń</p>
                <p className="font-semibold text-sm tabular-nums text-[#1f1d1b]">{fmtPLN(costsNetSum)}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-[#f0efec] flex items-baseline justify-between">
              <div>
                <p className="text-[#8d8a85] text-xs">Zysk</p>
                <p
                  className={`font-bold text-base tabular-nums ${
                    profitSum >= 0 ? "text-[#4f8a64]" : "text-[#b8523a]"
                  }`}
                >
                  {fmtPLN(profitSum)}
                </p>
              </div>
              {marginPctSum !== null && (
                <Badge tone={marginTone}>{marginPctSum.toFixed(1)}%</Badge>
              )}
            </div>
          </Card>
        )}

        <div className="flex justify-end mb-2">
          <ButtonLink href={`/jobs/new?clientId=${id}`} size="sm" icon={<span className="text-[15px] leading-none">+</span>}>
            Nowy pomiar
          </ButtonLink>
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            icon={<JobsGlyph />}
            title="Brak zleceń"
            hint="Zaplanuj pierwszy pomiar dla tego klienta."
            cta={{ href: `/jobs/new?clientId=${id}`, label: "+ Nowy pomiar" }}
            tone="accent"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {jobs.map((j) => {
              const m = marginByJob.get(j.id);
              const status = effectiveJobStatus(j);
              return (
                <li key={j.id}>
                  <Card href={`/jobs/${j.id}`} padded={false} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-[14px] text-[#1f1d1b] truncate">{j.title}</p>
                        <p className="text-[11px] text-[#8d8a85] mt-0.5">
                          {fmtPLN(j.amount_gross)} · {fmtDate(j.due_date ?? j.start_date)}
                        </p>
                      </div>
                      <Badge tone={jobStatusTone(status)}>{jobStatusLabel(status)}</Badge>
                    </div>
                    {m && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] flex-wrap">
                        <span className="text-[#8d8a85] tabular-nums">koszt {fmtPLN(m.costsNet)}</span>
                        <span
                          className={`tabular-nums font-semibold ${
                            m.profit >= 0 ? "text-[#4f8a64]" : "text-[#b8523a]"
                          }`}
                        >
                          zysk {fmtPLN(m.profit)}
                        </span>
                        {m.marginPct !== null && (
                          <span className="text-[#8d8a85] tabular-nums">· {m.marginPct.toFixed(0)}%</span>
                        )}
                        {!m.fromInvoices && (
                          <span className="text-[10px] text-[#b3b0aa]">(koszt z wyceny)</span>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Zakupy materiałów */}
      <section>
        <SectionHeading>
          Zakupy materiałów
        </SectionHeading>
        {materials.length > 0 && (
          <p className="-mt-1 mb-2 text-[13px] text-[#4a4843]">
            Razem: <b className="tabular-nums">{fmtPLN(materialsTotalGross)}</b>
          </p>
        )}

        {materials.length === 0 ? (
          <EmptyState
            icon={<BoxGlyph />}
            title="Brak zakupów materiałów"
            hint="Dodawane przez fakturę kosztową przypisaną do zlecenia z kategorią „materiały”."
            tone="neutral"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {materials.map((m) => (
              <li key={m.id}>
                <Card className="text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[14px] text-[#1f1d1b] truncate">{m.description}</p>
                      <p className="text-[11px] text-[#8d8a85] truncate mt-0.5">
                        {fmtDate(m.cost_date)}
                        {m.job_title && ` · ${m.job_title}`}
                        {m.invoice_supplier && ` · ${m.invoice_supplier}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold tabular-nums text-[#1f1d1b]">{fmtPLN(m.amount_gross)}</p>
                      <p className="text-[11px] text-[#8d8a85] tabular-nums">netto {fmtPLN(m.amount_net)}</p>
                    </div>
                  </div>
                  {m.invoice_id && (
                    <Link
                      href={`/invoices/${m.invoice_id}`}
                      className="text-[11px] text-[#a06f3f] underline-offset-2 hover:underline mt-1.5 inline-block"
                    >
                      Zobacz fakturę →
                    </Link>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={deleteWithId} className="mt-6">
        <ConfirmSubmitButton
          message={
            jobs.length > 0
              ? `Klient ma ${jobs.length} ${plJobs(jobs.length)}. Razem z klientem zostaną trwale usunięte wszystkie zlecenia (z czasem pracy i checklistami). Koszty z faktur zostaną zachowane jako koszty ogólne. Kontynuować?`
              : "Na pewno usunąć tego klienta?"
          }
          formNoValidate
          className="w-full text-sm text-[#b8523a] py-3 active:underline"
        >
          Usuń klienta
        </ConfirmSubmitButton>
      </form>
    </PageContainer>
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

function JobsGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="18" rx="2" />
      <path d="M9 2h6a1 1 0 0 1 1 1v3H8V3a1 1 0 0 1 1-1z" />
      <path d="M8 12h8M8 16h5" />
    </svg>
  );
}
function BoxGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12" />
    </svg>
  );
}
