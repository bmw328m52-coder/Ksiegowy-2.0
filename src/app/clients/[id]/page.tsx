import Link from "next/link";
import { notFound } from "next/navigation";
import ProjectCard from "@/components/job/ProjectCard";
import { Money } from "@/components/Money";
import { avatarTone, clientInitials } from "@/lib/avatar";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getClient } from "@/lib/dao/clients";
import { listJobsByClient } from "@/lib/dao/jobs";
import { jobCountsForProfitability } from "@/lib/dao/jobs.types";
import { listMaterialCostsByClient } from "@/lib/dao/cost_lines";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { getJobMarginsMap } from "@/lib/jobMargin";
import { getJobMaterialGrossMap } from "@/lib/dao/material_catalog";
import { effectiveJobStatus, isJobOverdue } from "@/lib/jobStatus";
import { fmtPLN, fmtDate } from "@/lib/format";
import { deleteClientAction } from "../actions";
import { PageContainer, Badge, EmptyState } from "@/components/ui";

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

  // Kwoty pokazujemy w brutto (jak wycena i „Suma zleceń" wyżej); netto drobnym pod spodem.
  let revenueGrossSum = 0;
  let costsGrossSum = 0;
  let revenueNetSum = 0;
  let costsNetSum = 0;
  const marginByJob = new Map<
    string,
    { profit: number; marginPct: number | null; costsGross: number; fromInvoices: boolean }
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

    const revenueGross = Number(j.amount_gross);
    const costsGross = fromInvoices ? inv!.costsGross : materialGrossByJob.get(j.id) ?? 0;
    const profit = revenueGross - costsGross;
    const marginPct = revenueGross > 0 ? (profit / revenueGross) * 100 : null;

    revenueGrossSum += revenueGross;
    costsGrossSum += costsGross;
    revenueNetSum += revenueNet;
    costsNetSum += costsNet;
    marginByJob.set(j.id, { profit, marginPct, costsGross, fromInvoices });
  }
  const profitSum = revenueGrossSum - costsGrossSum;
  const profitNetSum = revenueNetSum - costsNetSum;
  const marginPctSum = revenueGrossSum > 0 ? (profitSum / revenueGrossSum) * 100 : null;
  // Netto / VAT pokazujemy tylko, gdy faktycznie różni się od brutto (VAT-owiec, zlecenie z fakturą).
  const showNet = Math.abs(profitSum - profitNetSum) >= 0.01 || Math.abs(revenueGrossSum - revenueNetSum) >= 0.01;
  const marginTone =
    marginPctSum === null ? "neutral" : marginPctSum >= 20 ? "ok" : marginPctSum >= 0 ? "accent" : "warn";

  const deleteWithId = deleteClientAction.bind(null, id);
  const todayIso = new Date().toISOString().slice(0, 10);
  const tone = avatarTone(client.name);
  const activeCount = jobs.filter((j) => !["settled", "archived", "cancelled"].includes(j.status)).length;

  return (
    <PageContainer width="wide" className="lv-home">
      <header className="lc-hero">
        <div className="lc-hero-top">
          <Link href="/jobs?v=klienci" aria-label="Wstecz do listy" className="lj-back">
            ←
          </Link>
          <span className="lj-avatar lc-avatar" style={{ background: tone.bg, color: tone.fg }} aria-hidden>
            {clientInitials(client.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="lj-client">{client.type === "company" ? "Firma" : "Osoba prywatna"}</p>
            <h1 className="lj-title">{client.name}</h1>
            <div className="lc-chips">
              {client.phone && (
                <a href={`tel:${client.phone}`} className="lc-chip">
                  ☎ {client.phone}
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="lc-chip">
                  ✉ {client.email}
                </a>
              )}
              {client.nip && <span className="lc-chip" data-static="true">NIP {client.nip}</span>}
            </div>
            {client.address && <p className="lc-address">{client.address}</p>}
          </div>
          <Link href={`/clients/${id}/edit`} className="lc-edit">
            Edytuj
          </Link>
        </div>

        <dl className="lc-stats">
          <div>
            <dt>Zlecenia</dt>
            <dd>
              {jobs.length}
              {activeCount > 0 && <small> · {activeCount} w toku</small>}
            </dd>
          </div>
          <div>
            <dt>Suma zleceń</dt>
            <dd><Money>{fmtPLN(totalGross)}</Money></dd>
          </div>
          <div>
            <dt>Opłacone</dt>
            <dd><Money>{fmtPLN(paidGross)}</Money></dd>
          </div>
          {billableJobs.length > 0 && (
            <div>
              <dt>Zysk{marginPctSum !== null ? ` · ${marginPctSum.toFixed(0)}%` : ""}</dt>
              <dd data-neg={profitSum < 0}>
                <Money>{fmtPLN(profitSum)}</Money>
              </dd>
            </div>
          )}
        </dl>
      </header>

      <div className="lj-toolbar">
        <h2 className="lc-h2">Zlecenia klienta</h2>
        <Link href={`/jobs/new?clientId=${id}`} className="lj-cta">
          + Nowe zlecenie
        </Link>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={null}
          title="Brak zleceń"
          hint="Zaplanuj pierwszy pomiar dla tego klienta."
          cta={{ href: `/jobs/new?clientId=${id}`, label: "+ Nowe zlecenie" }}
          tone="accent"
        />
      ) : (
        <div className="lj-grid" role="list">
          {jobs.map((j) => {
            const m = marginByJob.get(j.id);
            const status = effectiveJobStatus(j);
            return (
              <ProjectCard
                key={j.id}
                job={{ ...j, status, client_name: client.name }}
                todayIso={todayIso}
                overdue={isJobOverdue({ ...j, status }, todayIso)}
                extra={
                  m ? (
                    <p className="lc-margin">
                      <span>koszt <Money>{fmtPLN(m.costsGross)}</Money></span>
                      <b data-neg={m.profit < 0}>
                        zysk <Money>{fmtPLN(m.profit)}</Money>
                        {m.marginPct !== null && ` · ${m.marginPct.toFixed(0)}%`}
                      </b>
                      {!m.fromInvoices && <small>koszt z wyceny</small>}
                    </p>
                  ) : null
                }
              />
            );
          })}
        </div>
      )}

      {billableJobs.length > 0 && (
        <section className="lv-card lc-box">
          <h2 className="lc-h2">
            Marża (brutto)
            {jobs.length !== billableJobs.length && <small> · od zamówienia materiałów</small>}
          </h2>
          <div className="lc-margin-grid">
            <div>
              <p>Przychód</p>
              <b><Money>{fmtPLN(revenueGrossSum)}</Money></b>
              {showNet && <small>netto <Money>{fmtPLN(revenueNetSum)}</Money></small>}
            </div>
            <div>
              <p>Koszty zleceń</p>
              <b><Money>{fmtPLN(costsGrossSum)}</Money></b>
              {showNet && <small>netto <Money>{fmtPLN(costsNetSum)}</Money></small>}
            </div>
            <div>
              <p>Zysk</p>
              <b data-neg={profitSum < 0}><Money>{fmtPLN(profitSum)}</Money></b>
              {showNet && (
                <small>
                  netto <Money>{fmtPLN(profitNetSum)}</Money> · VAT <Money>{fmtPLN(profitSum - profitNetSum)}</Money>
                </small>
              )}
            </div>
            {marginPctSum !== null && (
              <div>
                <p>Marża</p>
                <Badge tone={marginTone}>{marginPctSum.toFixed(1)}%</Badge>
              </div>
            )}
          </div>
        </section>
      )}

      {client.notes && (
        <section className="lv-card lc-box">
          <h2 className="lc-h2">Notatki</h2>
          <p className="whitespace-pre-wrap text-sm text-[var(--ink-2)]">{client.notes}</p>
        </section>
      )}

      <details className="group">
        <summary className="lc-fold">
          Zakupy materiałów
          <span>
            {materials.length > 0 ? `${materials.length} · ${fmtPLN(materialsTotalGross)}` : "brak"}
          </span>
        </summary>
        <div className="mt-3">
          {materials.length === 0 ? (
            <EmptyState
              icon={null}
              title="Brak zakupów materiałów"
              hint="Dodawane przez fakturę kosztową przypisaną do zlecenia z kategorią „materiały”."
              tone="neutral"
            />
          ) : (
            <ul className="lv-card lv-list">
              {materials.map((m) => (
                <li key={m.id} className="lc-mat">
                  <div className="min-w-0">
                    <p className="lc-mat-t">{m.description}</p>
                    <p className="lc-mat-s">
                      {fmtDate(m.cost_date)}
                      {m.job_title && ` · ${m.job_title}`}
                      {m.invoice_supplier && ` · ${m.invoice_supplier}`}
                      {m.invoice_id && (
                        <>
                          {" · "}
                          <Link href={`/invoices/${m.invoice_id}`} className="underline">
                            faktura
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <b className="tabular-nums"><Money>{fmtPLN(m.amount_gross)}</Money></b>
                    <small className="block text-[11px] text-[var(--muted)] tabular-nums">
                      netto <Money>{fmtPLN(m.amount_net)}</Money>
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <form action={deleteWithId} className="mt-2">
        <ConfirmSubmitButton
          message={
            jobs.length > 0
              ? `Klient ma ${jobs.length} ${plJobs(jobs.length)}. Razem z klientem zostaną trwale usunięte wszystkie zlecenia (z czasem pracy i checklistami). Koszty z faktur zostaną zachowane jako koszty ogólne. Kontynuować?`
              : "Na pewno usunąć tego klienta?"
          }
          formNoValidate
          className="w-full text-sm text-[var(--warn)] py-3 active:underline"
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
