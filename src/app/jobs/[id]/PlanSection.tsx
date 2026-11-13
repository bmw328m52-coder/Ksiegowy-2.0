import Link from "next/link";
import { listCostLinesByJob } from "@/lib/dao/cost_lines";
import { listEntriesByJob, totalMinutes } from "@/lib/dao/time_entries";
import { JOB_STATUS_DONE, type Job } from "@/lib/dao/jobs.types";
import { planVsActual, type JobPlan, type RateStatus } from "@/lib/profitability";
import { fmtDate, fmtPLN } from "@/lib/format";

const RATE_TONE: Record<RateStatus, string> = {
  cel: "text-[#3a6b4d]",
  minimum: "text-[var(--accent)]",
  ponizej: "text-red-700",
};

function fmtHours(h: number): string {
  return `${h.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} h`;
}

function fmtRate(v: number): string {
  return `${Math.round(v).toLocaleString("pl-PL")} zł/h`;
}

function pctDiff(actual: number, planned: number): string | null {
  if (planned <= 0 || Math.abs(actual - planned) < 0.005) return null;
  const pct = ((actual - planned) / planned) * 100;
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)}%`;
}

// Plan z kalkulatora (jobs.calc_quote.plan) obok wykonania: godziny z licznika i koszty
// z przypiętych faktur, przeliczone tym samym rachunkiem co wycena (lib/profitability).
export default async function PlanSection({
  job,
  plan,
  savedAt,
}: {
  job: Pick<Job, "id" | "amount_gross" | "status">;
  plan: JobPlan;
  savedAt: string;
}) {
  const [lines, entries] = await Promise.all([listCostLinesByJob(job.id), listEntriesByJob(job.id)]);
  const hours = totalMinutes(entries) / 60;
  const invoicesGross = lines.reduce((s, l) => s + (Number(l.amount_gross) || 0), 0);
  const amountGross = Number(job.amount_gross) || 0;
  const finished = JOB_STATUS_DONE.includes(job.status);

  const r = planVsActual(plan, { amountGross, hours, costsGross: invoicesGross, finished });
  const planHours = plan.input.hours;
  const planCosts = plan.input.costsGross;
  const priceChanged = amountGross > 0 && Math.abs(amountGross - plan.input.amountGross) > 0.005;
  const cashDiff = r.actual.netCash - r.planned.netCash;
  const hoursOver = hours > planHours + 0.05 ? pctDiff(hours, planHours) : null;
  const costsOver = invoicesGross > 0 ? pctDiff(invoicesGross, planCosts) : null;
  const missingPrice = r.priceForTarget - (amountGross > 0 ? amountGross : plan.input.amountGross);

  return (
    <section className="mt-3 rounded-xl border border-[#ededea] bg-white p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#8d8a85]">
          Plan a wykonanie
        </p>
        <span className="text-[11px] text-[#8d8a85]">{finished ? "wynik" : "w toku · prognoza"}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 text-sm">
        <span />
        <span className="text-right text-[10px] uppercase tracking-wide text-[#8d8a85]">Plan</span>
        <span className="text-right text-[10px] uppercase tracking-wide text-[#8d8a85]">
          {finished ? "Wyszło" : "Dziś"}
        </span>

        <span className="text-[#6f6c66]">Godziny</span>
        <span className="text-right tabular-nums text-[#3a3633]">
          {planHours > 0 ? fmtHours(planHours) : "—"}
        </span>
        <span className="text-right tabular-nums text-[#1f1d1b]">
          {hours > 0 ? fmtHours(hours) : "brak wpisów"}
          {hoursOver && <span className="ml-1 text-[11px] text-red-700">{hoursOver}</span>}
        </span>

        <span className="text-[#6f6c66]">Materiały brutto</span>
        <span className="text-right tabular-nums text-[#3a3633]">{fmtPLN(planCosts)}</span>
        <span className="text-right tabular-nums text-[#1f1d1b]">
          {invoicesGross > 0 ? fmtPLN(invoicesGross) : "brak faktur"}
          {costsOver && (
            <span
              className={`ml-1 text-[11px] ${invoicesGross > planCosts ? "text-red-700" : "text-[#3a6b4d]"}`}
            >
              {costsOver}
            </span>
          )}
        </span>

        {priceChanged && (
          <>
            <span className="text-[#6f6c66]">Cena brutto</span>
            <span className="text-right tabular-nums text-[#3a3633]">{fmtPLN(plan.input.amountGross)}</span>
            <span className="text-right tabular-nums text-[#1f1d1b]">{fmtPLN(amountGross)}</span>
          </>
        )}

        <span className="border-t border-[#f0efec] pt-2 text-[#3a3633]">Na rękę</span>
        <span className="border-t border-[#f0efec] pt-2 text-right tabular-nums text-[#3a3633]">
          {fmtPLN(r.planned.netCash)}
        </span>
        <span className="border-t border-[#f0efec] pt-2 text-right tabular-nums font-medium text-[#1f1d1b]">
          {fmtPLN(r.actual.netCash)}
        </span>

        <span className="font-semibold text-[#1f1d1b]">Stawka na rękę</span>
        <span
          className={`text-right tabular-nums font-semibold ${
            r.plannedStatus ? RATE_TONE[r.plannedStatus] : "text-[#3a3633]"
          }`}
        >
          {planHours > 0 ? fmtRate(r.planned.ratePerHour) : "—"}
        </span>
        <span
          className={`text-right tabular-nums font-semibold ${
            r.actualStatus ? RATE_TONE[r.actualStatus] : "text-[#1f1d1b]"
          }`}
        >
          {r.hoursUsed > 0 ? fmtRate(r.actual.ratePerHour) : "—"}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-[#f0efec] space-y-1 text-[11px] text-[#6f6c66]">
        {planHours <= 0 && (
          <p className="text-[var(--accent)]">
            Plan nie ma godzin — otwórz kalkulator, wpisz czas pracy i przenieś wycenę ponownie.
          </p>
        )}
        {Math.abs(cashDiff) >= 1 && (
          <p>
            {cashDiff < 0 ? "Względem planu tracisz" : "Względem planu zyskujesz"}{" "}
            <span className={`font-semibold tabular-nums ${cashDiff < 0 ? "text-red-700" : "text-[#3a6b4d]"}`}>
              {fmtPLN(Math.abs(cashDiff))}
            </span>{" "}
            na rękę.
          </p>
        )}
        {r.actualStatus && r.actualStatus !== "cel" && missingPrice >= 1 && (
          <p>
            Przy tych godzinach i kosztach cel {fmtRate(plan.targetRate)} dawałaby cena{" "}
            <span className="font-semibold tabular-nums text-[#1f1d1b]">
              {fmtPLN(Math.ceil(r.priceForTarget))}
            </span>{" "}
            brutto (o {fmtPLN(Math.ceil(missingPrice))} więcej).
          </p>
        )}
        {(r.hoursFromPlan || r.costsFromPlan) && (
          <p>
            {finished ? "Brakuje danych: do wyniku wzięte z planu " : "W toku: do prognozy liczę nie mniej niż plan — "}
            {[r.hoursFromPlan ? "godziny" : null, r.costsFromPlan ? "materiały" : null]
              .filter(Boolean)
              .join(" i ")}
            .
          </p>
        )}
        <div className="flex items-center justify-between pt-1">
          <Link
            href={`/calculator?job=${job.id}`}
            className="inline-flex items-center min-h-11 font-medium text-[#a06f3f] underline-offset-2 hover:underline"
          >
            Otwórz plan w kalkulatorze →
          </Link>
          <span className="text-[10px] text-[var(--muted)]">plan z {fmtDate(savedAt)}</span>
        </div>
      </div>
    </section>
  );
}
