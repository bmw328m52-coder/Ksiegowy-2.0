import Link from "next/link";
import { listCostLinesByJob } from "@/lib/dao/cost_lines";
import { CATEGORY_COLORS } from "@/lib/dao/cost_lines.types";
import { listMaterialsByJob } from "@/lib/dao/material_catalog";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { computeJobMarginFull } from "@/lib/jobMargin";
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
  const [lines, materials, settings] = await Promise.all([
    listCostLinesByJob(job.id),
    listMaterialsByJob(job.id),
    getUserSettingsOrDefault(),
  ]);
  const isVat = settings.is_vat_payer;
  const m = computeJobMarginFull(job, lines, materials, isVat);
  const basis = isVat ? "(netto)" : "(brutto, bez VAT)";

  const hasData = m.revenueGross > 0 || m.materialCount > 0 || m.invoiceCount > 0;

  return (
    <section className="mt-4 rounded-xl border border-[#e8e4dd] bg-white p-4">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-[#9c9081] mb-3">
        Rentowność
      </p>

      {!hasData ? (
        <p className="text-sm text-[#9c9081]">
          Brak danych. Ustaw wartość zlecenia (przez „Edytuj”) i dodaj pozycje w wycenie — zysk
          szacunkowy policzy się od razu.
        </p>
      ) : (
        <>
          {/* Szacunek z wyceny */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[#9c9081]">Przychód {basis}</p>
              <p className="font-medium text-sm tabular-nums text-[#282624]">
                {fmtPLN(m.revenueNet)}
              </p>
            </div>
            <div>
              <p className="text-[#9c9081]">
                Materiały z wyceny {m.materialCount > 0 ? `(${m.materialCount})` : ""}
              </p>
              <p className="font-medium text-sm tabular-nums text-[#282624]">
                {m.materialCount > 0 ? fmtPLN(m.materialCostNet) : "—"}
              </p>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-[#f0ece4] flex items-baseline justify-between">
            <div>
              <p className="text-[#9c9081] text-xs">Zysk szacunkowy</p>
              <p
                className={`font-semibold text-base tabular-nums ${
                  m.estProfit >= 0 ? "text-[#3a6b4d]" : "text-red-700"
                }`}
              >
                {fmtPLN(m.estProfit)}
              </p>
              <p className="text-[10px] text-[#9c9081]">wartość − materiały (robocizna + marża)</p>
            </div>
            {m.estMarginPct !== null && <MarginBadge pct={m.estMarginPct} />}
          </div>

          {m.materialCount === 0 && (
            <p className="mt-2 text-[11px] text-[#b08968]">
              Brak pozycji w wycenie — koszt materiałów = 0. Dodaj materiały w „Wycenie pozycji”.
            </p>
          )}

          {m.revenueGross === 0 && (
            <p className="mt-2 text-[11px] text-[#b08968]">
              Wartość zlecenia = 0 — ustaw ją przez „Edytuj”, żeby zysk był miarodajny.
            </p>
          )}

          {/* Realne koszty z faktur */}
          <div className="mt-3 pt-3 border-t border-[#f0ece4]">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-[#9c9081]">
                Realny wynik z faktur
              </p>
              {m.invoiceCount > 0 && m.realMarginPct !== null && (
                <MarginBadge pct={m.realMarginPct} />
              )}
            </div>

            {m.invoiceCount === 0 ? (
              <p className="mt-1 text-xs text-[#9c9081]">
                Brak faktur kosztowych. Przypnij faktury do tego zlecenia, a policzę realny zysk
                (zamiast szacunku z wyceny).
              </p>
            ) : (
              <>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[#9c9081]">Koszty z faktur {basis}</p>
                    <p className="font-medium text-sm tabular-nums text-[#282624]">
                      {fmtPLN(m.invoiceCostsNet)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#9c9081]">Realny zysk</p>
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
                    const tone = (l.category && CATEGORY_COLORS[l.category]) || "#9c9081";
                    return (
                      <li key={l.id} className="flex items-start justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-[#282624] break-words">{l.description}</p>
                          <p className="text-[11px] text-[#9c9081] mt-0.5 flex items-center gap-1.5 flex-wrap">
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
                          <p className="font-medium tabular-nums text-[#282624]">
                            {fmtPLN(l.amount_gross)}
                          </p>
                          {isVat && (
                            <p className="text-[11px] text-[#9c9081] tabular-nums">
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
