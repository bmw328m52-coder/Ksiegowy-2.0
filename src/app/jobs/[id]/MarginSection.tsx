import Link from "next/link";
import { listCostLinesByJob } from "@/lib/dao/cost_lines";
import { CATEGORY_COLORS } from "@/lib/dao/cost_lines.types";
import { listMaterialsByJob } from "@/lib/dao/material_catalog";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { computeJobMarginFull } from "@/lib/jobMargin";
import { listEntriesByJob, totalMinutes } from "@/lib/dao/time_entries";
import { createClient } from "@/lib/supabase/server";
import { fmtPLN, fmtDate } from "@/lib/format";
import type { Job } from "@/lib/dao/jobs.types";

type InvoiceHead = {
  id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  issue_date: string | null;
};

async function getInvoiceHeads(ids: string[]): Promise<Map<string, InvoiceHead>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, supplier_name, invoice_number, issue_date")
    .in("id", ids);
  if (error) throw error;
  return new Map(((data ?? []) as InvoiceHead[]).map((i) => [i.id, i]));
}

// Koszty zlecenia. Główne źródło = faktury kosztowe przypięte do zlecenia (cost_lines).
// Szacunek z wyceny (job_materials) jest schowany niżej — tylko do porównania.
export default async function MarginSection({
  job,
}: {
  job: Pick<Job, "id" | "amount_gross" | "vat_rate">;
}) {
  const [lines, materials, settings, entries] = await Promise.all([
    listCostLinesByJob(job.id),
    listMaterialsByJob(job.id),
    getUserSettingsOrDefault(),
    listEntriesByJob(job.id),
  ]);
  const invoiceIds = [...new Set(lines.map((l) => l.invoice_id).filter((x): x is string => !!x))];
  const heads = await getInvoiceHeads(invoiceIds);

  const hours = totalMinutes(entries) / 60;
  const isVat = settings.is_vat_payer;
  const m = computeJobMarginFull(job, lines, materials, isVat);
  // VAT liczony tylko, gdy jesteś VAT-owcem I zlecenie ma niezerową stawkę.
  // „Bez faktury" ustawia stawkę 0 → kwoty są brutto (netto = brutto).
  const vatApplies = isVat && Number(job.vat_rate) > 0;
  const basis = vatApplies ? "netto" : "brutto";
  // Koszty z faktur: VAT-owiec odlicza VAT naliczony (faktura idzie do JPK), więc realny
  // koszt = netto — także przy zleceniu „bez faktury”, gdzie przychód jest brutto.
  const costBasis = isVat ? "netto, VAT odliczony" : "brutto";
  const hasInvoices = m.invoiceCount > 0;

  // Pozycje pogrupowane po fakturze (faktura z KSeF potrafi mieć kilkadziesiąt linii).
  const groups = new Map<string, typeof lines>();
  for (const l of lines) {
    const key = l.invoice_id ?? "__manual__";
    const arr = groups.get(key) ?? [];
    arr.push(l);
    groups.set(key, arr);
  }

  return (
    <section className="mt-3 rounded-xl border border-[#ededea] bg-white p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#8d8a85]">
          Koszty zlecenia
        </p>
        {hasInvoices && (
          <span className="text-sm font-semibold tabular-nums text-[#1f1d1b]">
            {fmtPLN(m.invoiceCostsGross)}
            <span className="ml-1 text-[11px] font-normal text-[#8d8a85]">brutto</span>
          </span>
        )}
      </div>

      {!hasInvoices ? (
        <div className="rounded-lg bg-[#f6f6f5] px-3 py-2.5 text-xs text-[#6f6c66]">
          Brak przypiętych faktur. Wejdź w{" "}
          <Link href="/invoices" className="font-semibold text-[#a06f3f] underline-offset-2 hover:underline">
            Faktury
          </Link>
          , otwórz fakturę i wybierz to zlecenie w „Cała faktura → zlecenie”.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...groups.entries()].map(([key, ls]) => {
            const head = key === "__manual__" ? null : heads.get(key);
            const sumGross = ls.reduce((s, l) => s + (Number(l.amount_gross) || 0), 0);
            const sumNet = ls.reduce((s, l) => s + (Number(l.amount_net) || 0), 0);
            return (
              <li key={key}>
                <details className="group rounded-lg border border-[#ededea]">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-2.5 active:bg-[#f6f6f5]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1f1d1b] truncate">
                        {head?.supplier_name ?? (head ? "Faktura" : "Koszty bez faktury")}
                      </p>
                      <p className="text-[11px] text-[#8d8a85] truncate">
                        {[head?.invoice_number, head?.issue_date ? fmtDate(head.issue_date) : null, `${ls.length} poz.`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-[#1f1d1b]">{fmtPLN(sumGross)}</p>
                      {isVat && (
                        <p className="text-[11px] tabular-nums text-[#8d8a85]">netto {fmtPLN(sumNet)}</p>
                      )}
                    </div>
                  </summary>
                  <ul className="border-t border-[#f0efec] px-3 py-2 flex flex-col gap-1.5">
                    {ls.map((l) => {
                      const tone = (l.category && CATEGORY_COLORS[l.category]) || "#8d8a85";
                      return (
                        <li key={l.id} className="flex items-start justify-between gap-3 text-xs">
                          <span className="min-w-0 text-[#3a3633] break-words">
                            {l.description}
                            {l.category && (
                              <span
                                className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                                style={{ backgroundColor: tone }}
                              >
                                {l.category}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums text-[#1f1d1b]">{fmtPLN(l.amount_gross)}</span>
                        </li>
                      );
                    })}
                    {head && (
                      <li className="pt-1">
                        <Link
                          href={`/invoices/${head.id}`}
                          className="text-[11px] font-medium text-[#a06f3f] underline-offset-2 hover:underline"
                        >
                          Otwórz fakturę →
                        </Link>
                      </li>
                    )}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {/* Wynik — z faktur, gdy są; inaczej nic nie udajemy */}
      {hasInvoices && (
        <div className="mt-3 pt-3 border-t border-[#f0efec] space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[#8d8a85]">Wartość zlecenia ({vatApplies ? "netto" : "bez VAT"})</span>
            <span className="tabular-nums text-[#1f1d1b]">{fmtPLN(m.revenueNet)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8d8a85]">− Koszty z faktur ({costBasis})</span>
            <span className="tabular-nums text-[#1f1d1b]">− {fmtPLN(m.invoiceCostsNet)}</span>
          </div>
          {m.revenueGross > 0 ? (
            <div className="flex items-center justify-between pt-1.5 border-t border-[#f0efec]">
              <span className="font-semibold text-[#1f1d1b]">Zysk</span>
              <span className="flex items-center gap-2">
                {m.realMarginPct !== null && <MarginBadge pct={m.realMarginPct} />}
                <span
                  className={`font-semibold tabular-nums ${m.realProfit >= 0 ? "text-[#3a6b4d]" : "text-red-700"}`}
                >
                  {fmtPLN(m.realProfit)}
                </span>
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-[#b08968]">
              Wartość zlecenia = 0 —{" "}
              <Link href={`/jobs/${job.id}/edit`} className="font-semibold text-[#a06f3f] underline-offset-2 hover:underline">
                ustaw kwotę
              </Link>
              , żeby policzyć zysk.
            </p>
          )}
          {hours > 0 && m.revenueGross > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-[#8d8a85]">
                Na godzinę ({hours.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} h)
              </span>
              <span className="tabular-nums text-[#3a3633]">
                {Math.round(m.realProfit / hours).toLocaleString("pl-PL")} zł/h
              </span>
            </div>
          )}
        </div>
      )}

      {/* Moja wycena — na boku, do porównania */}
      <details className="group mt-3 rounded-lg bg-[#f6f6f5]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs text-[#6f6c66]">
          <span>
            Szacunek z wyceny
            {m.materialCount > 0 && (
              <span className="ml-1 tabular-nums">· materiały {fmtPLN(m.materialCostNet)}</span>
            )}
          </span>
          <span className="text-[#b3b0aa] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-3 pb-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#8d8a85]">Materiały z wyceny ({m.materialCount} poz., {basis})</span>
            <span className="tabular-nums text-[#3a3633]">{m.materialCount > 0 ? fmtPLN(m.materialCostNet) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8d8a85]">Zysk szacunkowy</span>
            <span className="flex items-center gap-2">
              {m.estMarginPct !== null && <MarginBadge pct={m.estMarginPct} />}
              <span className={`tabular-nums ${m.estProfit >= 0 ? "text-[#3a6b4d]" : "text-red-700"}`}>
                {fmtPLN(m.estProfit)}
              </span>
            </span>
          </div>
          {hasInvoices && m.materialCount > 0 && (
            <div className="flex justify-between">
              <span className="text-[#8d8a85]">Faktury vs wycena</span>
              <span
                className={`tabular-nums ${m.invoiceCostsGross > m.materialCostGross ? "text-red-700" : "text-[#3a6b4d]"}`}
              >
                {m.invoiceCostsGross > m.materialCostGross ? "+" : "−"}
                {fmtPLN(Math.abs(m.invoiceCostsGross - m.materialCostGross))} brutto
              </span>
            </div>
          )}
          <Link
            href={`/jobs/${job.id}/wycena`}
            className="inline-block pt-1 font-medium text-[#a06f3f] underline-offset-2 hover:underline"
          >
            Otwórz wycenę pozycji →
          </Link>
        </div>
      </details>
    </section>
  );
}

function MarginBadge({ pct }: { pct: number }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        pct >= 20
          ? "bg-[#e3efe5] text-[#3a6b4d]"
          : pct >= 0
            ? "bg-[#faf5e9] text-[#a18653]"
            : "bg-red-100 text-red-700"
      }`}
    >
      marża {pct.toFixed(1)}%
    </span>
  );
}
