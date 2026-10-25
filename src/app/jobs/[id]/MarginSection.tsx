import Link from "next/link";
import { listCostLinesByJob } from "@/lib/dao/cost_lines";
import { CATEGORY_COLORS } from "@/lib/dao/cost_lines.types";
import { listMaterialsByJob } from "@/lib/dao/material_catalog";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { computeJobMarginFull } from "@/lib/jobMargin";
import { listEntriesByJob, totalMinutes } from "@/lib/dao/time_entries";
import { fmtPLN, fmtDate } from "@/lib/format";
import type { Job } from "@/lib/dao/jobs.types";

// Rentowność zlecenia. Przychód = uzgodniona wartość (amount_gross). Koszty z DWÓCH źródeł:
//  • szacunek z wyceny (suma pozycji job_materials = ceny zakupu z cennika) — dostępny od razu,
//  • realne faktury kosztowe (cost_lines) — wypełnia się, gdy przypniesz faktury do zlecenia.
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
  const hours = totalMinutes(entries) / 60;
  const isVat = settings.is_vat_payer;
  const m = computeJobMarginFull(job, lines, materials, isVat);
  // VAT liczony tylko, gdy jesteś VAT-owcem I zlecenie ma niezerową stawkę.
  // „Bez faktury" ustawia stawkę 0 → kwoty są brutto (netto = brutto).
  const vatApplies = isVat && Number(job.vat_rate) > 0;
  const basis = vatApplies ? "(netto)" : "(brutto, bez VAT)";

  const hasData = m.revenueGross > 0 || m.materialCount > 0 || m.invoiceCount > 0;

  return (
    <section className="mt-4 rounded-xl border border-[#cfe0ee] bg-[#eef3f8] p-4">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-[#3a648f] mb-3">
        Rentowność
      </p>

      {!hasData ? (
        <div className="space-y-2.5">
          <p className="text-sm text-[#8d8a85]">
            Brak danych. Ustaw wartość zlecenia i dodaj pozycje w wycenie — zysk szacunkowy
            policzy się od razu.
          </p>
          <Link
            href={`/jobs/${job.id}/edit`}
            className="inline-flex rounded-lg bg-[#a06f3f] px-3 py-1.5 text-[12px] font-semibold text-white active:opacity-80 hover:bg-[#7d5530] transition-colors"
          >
            Ustaw wartość zlecenia →
          </Link>
        </div>
      ) : (
        <>
          {/* Szacunek z wyceny */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[#8d8a85]">Przychód {basis}</p>
              <p className="font-medium text-sm tabular-nums text-[#1f1d1b]">
                {fmtPLN(m.revenueNet)}
              </p>
            </div>
            <div>
              <p className="text-[#8d8a85]">
                Materiały z wyceny {m.materialCount > 0 ? `(${m.materialCount})` : ""}
              </p>
              <p className="font-medium text-sm tabular-nums text-[#1f1d1b]">
                {m.materialCount > 0 ? fmtPLN(m.materialCostNet) : "—"}
              </p>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-[#d7e3ef] flex items-baseline justify-between">
            <div>
              <p className="text-[#8d8a85] text-xs">Zysk szacunkowy</p>
              <p
                className={`font-semibold text-base tabular-nums ${
                  m.estProfit >= 0 ? "text-[#3a6b4d]" : "text-red-700"
                }`}
              >
                {fmtPLN(m.estProfit)}
              </p>
              <p className="text-[10px] text-[#8d8a85]">wartość − materiały (robocizna + marża)</p>
            </div>
            {m.estMarginPct !== null && <MarginBadge pct={m.estMarginPct} />}
          </div>

          {hours > 0 && (
            <div className="mt-2 pt-2 border-t border-[#d7e3ef] flex items-baseline justify-between">
              <div>
                <p className="text-[#8d8a85] text-xs">Na godzinę pracy</p>
                <p className="text-[10px] text-[#8d8a85]">
                  zysk ÷ {hours.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} h
                </p>
              </div>
              <p
                className={`font-semibold text-base tabular-nums ${
                  m.estProfit / hours >= (settings.default_hourly_rate ?? 0) ? "text-[#3a6b4d]" : "text-[#b08968]"
                }`}
              >
                {Math.round(m.estProfit / hours).toLocaleString("pl-PL")} zł/h
              </p>
            </div>
          )}

          {m.materialCount === 0 && (
            <p className="mt-2 text-[11px] text-[#b08968]">
              Brak pozycji w wycenie — koszt materiałów = 0. Dodaj materiały w „Wycenie pozycji”.
            </p>
          )}

          {m.revenueGross === 0 && (
            <p className="mt-2 text-[11px] text-[#b08968]">
              Wartość zlecenia = 0 —{" "}
              <Link href={`/jobs/${job.id}/edit`} className="font-semibold text-[#a06f3f] underline-offset-2 hover:underline">
                ustaw kwotę
              </Link>
              , żeby zysk był miarodajny.
            </p>
          )}

          {/* Realne koszty z faktur */}
          <div className="mt-3 pt-3 border-t border-[#d7e3ef]">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-[#8d8a85]">
                Realny wynik z faktur
              </p>
              {m.invoiceCount > 0 && m.realMarginPct !== null && (
                <MarginBadge pct={m.realMarginPct} />
              )}
            </div>

            {m.invoiceCount === 0 ? (
              <p className="mt-1 text-xs text-[#8d8a85]">
                Brak faktur kosztowych. Przypnij faktury do tego zlecenia, a policzę realny zysk
                (zamiast szacunku z wyceny).
              </p>
            ) : (
              <>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[#8d8a85]">Koszty z faktur {basis}</p>
                    <p className="font-medium text-sm tabular-nums text-[#1f1d1b]">
                      {fmtPLN(m.invoiceCostsNet)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#8d8a85]">Realny zysk</p>
                    <p
                      className={`font-semibold text-sm tabular-nums ${
                        m.realProfit >= 0 ? "text-[#3a6b4d]" : "text-red-700"
                      }`}
                    >
                      {fmtPLN(m.realProfit)}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 flex flex-col gap-2">
                  {lines.map((l) => {
                    const tone = (l.category && CATEGORY_COLORS[l.category]) || "#8d8a85";
                    return (
                      <li key={l.id} className="flex items-start justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-[#1f1d1b] break-words">{l.description}</p>
                          <p className="text-[11px] text-[#8d8a85] mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="tabular-nums">{fmtDate(l.cost_date)}</span>
                            {l.category && (
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                                style={{ backgroundColor: tone }}
                              >
                                {l.category}
                              </span>
                            )}
                            {l.invoice_id && (
                              <Link
                                href={`/invoices/${l.invoice_id}`}
                                className="text-[#a06f3f] underline-offset-2 hover:underline"
                              >
                                faktura
                              </Link>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-medium tabular-nums text-[#1f1d1b]">
                            {fmtPLN(l.amount_gross)}
                          </p>
                          {isVat && (
                            <p className="text-[11px] text-[#8d8a85] tabular-nums">
                              netto {fmtPLN(l.amount_net)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function MarginBadge({ pct }: { pct: number }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
