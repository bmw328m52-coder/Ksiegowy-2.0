"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import type { CalcResult, TaxForm } from "@/lib/tax";
import {
  calcJobProfit,
  rateStatus,
  requiredHourlyRate,
  requiredPriceGross,
  type JobPlan,
  type JobProfitInput,
  type RateStatus,
} from "@/lib/profitability";
import { ZUS_SOCIAL_FULL_2026, ZUS_SOCIAL_PREF_2026 } from "@/lib/zus";
import { fmtDate, fmtPLN, parseAmount } from "@/lib/format";
import type { QuoteTemplate } from "@/lib/dao/quote_templates.types";
import {
  saveQuoteTemplateAction,
  deleteQuoteTemplateAction,
  createJobForQuoteAction,
} from "./actions";
import { applyQuoteToJobAction } from "@/app/jobs/actions";
import type { CalcQuote } from "@/lib/dao/jobs.types";
import { useRouter } from "next/navigation";

type JobOption = {
  id: string;
  title: string;
  client_name: string;
  costs_net: number;
  costs_vat: number;
  /** Suma pozycji wyceny (job_materials) brutto — koszt materiałów, gdy brak faktur kosztowych. */
  materials_gross: number;
  /** Plan zapisany na zleceniu przy poprzednim „Przenieś wycenę" (jobs.calc_quote.plan). */
  plan: JobPlan | null;
  plan_saved_at: string | null;
};

// Koszt zlecenia do kalkulatora: najpierw realne faktury kosztowe (cost_lines),
// a gdy ich brak — szacunek z wyceny (job_materials). Spójne z modelem kosztów Artura.
function jobCostGross(job: JobOption): number {
  const invoices = job.costs_net + job.costs_vat;
  return invoices > 0 ? invoices : job.materials_gross;
}

// Koszt planowany = pozycje wyceny, ale tylko gdy są już faktury do porównania.
function jobPlannedGross(job: JobOption): number {
  return job.costs_net + job.costs_vat > 0 ? job.materials_gross : 0;
}

// Pola kosztów po wyborze zlecenia. Gdy zlecenie ma zapisany plan, planem są koszty z wyceny
// z tamtej chwili, a rzeczywistością faktury (jeśli już są).
function jobCostFields(job: JobOption): { costs: number; planned: number } {
  const planCosts = job.plan?.input.costsGross ?? 0;
  if (planCosts <= 0) return { costs: jobCostGross(job), planned: jobPlannedGross(job) };
  const invoices = job.costs_net + job.costs_vat;
  return invoices > 0 ? { costs: invoices, planned: planCosts } : { costs: planCosts, planned: 0 };
}

type BomLine = { id: string; category: string; amountStr: string };

// Czynsz warsztatu (z prądem) — koszt stały co miesiąc, jak ZUS. Kwota pamiętana lokalnie.
const RENT_STORAGE_KEY = "calc.workshopRentMonthly";
const DEFAULT_WORKSHOP_RENT = 300;
const HOURS_PER_DAY = 8;
// Cel zarobku — pamiętany na urządzeniu, żeby nie wpisywać przy każdej wycenie.
const MONTHLY_TARGET_KEY = "calc.monthlyTarget";
const BILLABLE_HOURS_KEY = "calc.billableHoursMonth";
const TARGET_RATE_KEY = "calc.targetRate";
const MIN_RATE_KEY = "calc.minRate";
const AVAILABLE_HOURS_MONTH = 160;
const RATE_PRESETS = [75, 90, 100, 110, 120];

const PREF_EVENT = "luviano:calcPrefs";
// Kopia w pamięci — pole działa także, gdy localStorage jest zablokowany.
const prefMemory = new Map<string, string>();

function subscribePrefs(cb: () => void) {
  window.addEventListener(PREF_EVENT, cb);
  return () => window.removeEventListener(PREF_EVENT, cb);
}

function usePref(key: string, fallback: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    subscribePrefs,
    () => {
      const mem = prefMemory.get(key);
      if (mem !== undefined) return mem;
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = (v: string) => {
    prefMemory.set(key, v);
    try {
      localStorage.setItem(key, v);
    } catch {}
    window.dispatchEvent(new Event(PREF_EVENT));
  };
  return [value, set];
}

const STATUS_TONE: Record<
  RateStatus,
  { box: string; label: string; value: string; sub: string; text: string }
> = {
  cel: {
    box: "border-emerald-300 bg-emerald-50",
    label: "text-emerald-700",
    value: "text-emerald-900",
    sub: "text-emerald-700/80",
    text: "Cel osiągnięty",
  },
  minimum: {
    box: "border-amber-300 bg-amber-50",
    label: "text-amber-800",
    value: "text-amber-900",
    sub: "text-amber-800/80",
    text: "Powyżej minimum, poniżej celu",
  },
  ponizej: {
    box: "border-red-300 bg-red-50",
    label: "text-red-700",
    value: "text-red-900",
    sub: "text-red-700/80",
    text: "Poniżej minimum",
  },
};

function fmtRate(v: number): string {
  return `${fmtPLN(v)}/h`;
}

function makeBomLine(category = ""): BomLine {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
    category,
    amountStr: "",
  };
}

export default function CalculatorForm({
  jobs: initialJobs,
  clients,
  defaultTaxForm,
  defaultVatRate,
  defaultIsVatPayer,
  defaultYearIncome,
  templates,
  materialCategories,
  defaultSocialMonthly,
  zusPhaseLabel,
  healthMinMonthly,
  initialJobId,
}: {
  jobs: JobOption[];
  clients: { id: string; name: string }[];
  defaultTaxForm: TaxForm;
  defaultVatRate: number;
  defaultIsVatPayer: boolean;
  defaultYearIncome: number;
  templates: QuoteTemplate[];
  materialCategories: string[];
  /** Składki społeczne wg dzisiejszej fazy ZUS (ulga na start = 0). */
  defaultSocialMonthly: number;
  zusPhaseLabel: string;
  healthMinMonthly: number;
  initialJobId?: string;
}) {
  // Zlecenia założone w tej sesji kalkulatora („+ Nowy klient / nowe zlecenie").
  const [createdJobs, setCreatedJobs] = useState<JobOption[]>([]);
  const jobs = [...createdJobs.filter((c) => !initialJobs.some((j) => j.id === c.id)), ...initialJobs];
  const presetJob = initialJobId ? jobs.find((j) => j.id === initialJobId) : undefined;
  const presetCosts = presetJob ? jobCostFields(presetJob) : { costs: 0, planned: 0 };
  const presetCostsGross = presetCosts.costs;
  const presetPlanned = presetCosts.planned;
  // Zlecenie z zapisanym planem otwiera kalkulator z tamtymi danymi, nie z pustymi polami.
  const presetPlan = presetJob?.plan ?? null;
  const pp = presetPlan?.input;

  const [amountStr, setAmountStr] = useState(pp ? pp.amountGross.toFixed(2) : "");
  const [vatPct, setVatPct] = useState(String(Math.round((pp?.vatRate ?? defaultVatRate) * 100)));
  const [taxForm, setTaxForm] = useState<TaxForm>(pp?.taxForm ?? defaultTaxForm);
  const [isVatPayer, setIsVatPayer] = useState<boolean>(pp?.isVatPayer ?? defaultIsVatPayer);
  const [yearIncomeStr, setYearIncomeStr] = useState(
    defaultYearIncome > 0 ? defaultYearIncome.toFixed(2) : ""
  );
  const [yearIncomeOverride, setYearIncomeOverride] = useState(false);
  const [costsGrossStr, setCostsGrossStr] = useState(
    presetCostsGross > 0 ? presetCostsGross.toFixed(2) : "",
  );
  const [costsVatPct, setCostsVatPct] = useState(
    pp && pp.isVatPayer ? String(Math.round(pp.costsVatRate * 100)) : "23",
  );
  const [jobId, setJobId] = useState<string>(presetJob ? presetJob.id : "");
  const [useBom, setUseBom] = useState(false);
  const [bomLines, setBomLines] = useState<BomLine[]>([makeBomLine()]);
  const [templateId, setTemplateId] = useState<string>("");
  const [showSave, setShowSave] = useState(false);
  const [pitFlat, setPitFlat] = useState(pp?.pitFlat ?? false);
  const [hoursStr, setHoursStr] = useState(pp && pp.hours > 0 ? String(pp.hours) : "");
  const [timeUnit, setTimeUnit] = useState<"h" | "dni">("h");
  const [rentStr, onRentChange] = usePref(RENT_STORAGE_KEY, DEFAULT_WORKSHOP_RENT.toFixed(2));
  // Pole ZUS = cała miesięczna opłata, razem ze zdrowotną (na uldze na start to sama zdrowotna).
  const [zusStr, setZusStr] = useState(
    (pp ? pp.socialMonthly + pp.healthMinMonthly : defaultSocialMonthly + healthMinMonthly).toFixed(2),
  );
  const [hoursPerMonthStr, setHoursPerMonthStr] = usePref(BILLABLE_HOURS_KEY, "120");
  const [monthlyTargetStr, setMonthlyTargetStr] = usePref(MONTHLY_TARGET_KEY, "12000");
  // Pusta = stawka wynika z celu miesięcznego ÷ godziny płatne.
  const [targetRateStr, setTargetRateStr] = usePref(TARGET_RATE_KEY, "");
  const [minRateStr, setMinRateStr] = usePref(MIN_RATE_KEY, "75");
  const [plannedCostsStr, setPlannedCostsStr] = useState(
    presetPlanned > 0 ? presetPlanned.toFixed(2) : "",
  );
  const [discountStr, setDiscountStr] = useState("");
  const [discountMode, setDiscountMode] = useState<"zl" | "pct">("zl");
  const [withInvoice, setWithInvoice] = useState(pp?.withInvoice ?? true);
  const [deductCostsVat, setDeductCostsVat] = useState(pp?.deductCostsVat ?? false);
  const [reserveVacation, setReserveVacation] = useState(presetPlan?.reserveVacation ?? false);
  const [reserveSick, setReserveSick] = useState(presetPlan?.reserveSick ?? false);
  const [templateName, setTemplateName] = useState("");
  const [saveState, saveAction, savePending] = useActionState(saveQuoteTemplateAction, {
    error: undefined as string | undefined,
  });
  const router = useRouter();
  const [showNewJob, setShowNewJob] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobPending, setNewJobPending] = useState(false);
  const [newJobError, setNewJobError] = useState<string | undefined>(undefined);
  const [applyPending, setApplyPending] = useState(false);
  const [applyError, setApplyError] = useState<string | undefined>(undefined);

  function loadTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setAmountStr(Number(t.amount_gross).toFixed(2));
    setVatPct(String(Math.round(Number(t.vat_rate) * 100)));
    setCostsGrossStr(Number(t.costs_gross).toFixed(2));
    setCostsVatPct(String(Math.round(Number(t.costs_vat_rate) * 100)));
    setTaxForm(t.tax_form);
    setIsVatPayer(t.is_vat_payer);
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Usunąć ten szablon?")) return;
    await deleteQuoteTemplateAction(id);
    if (templateId === id) setTemplateId("");
  }

  function onJobChange(id: string) {
    setJobId(id);
    setApplyError(undefined);
    if (!id) return;
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    const { costs: gross, planned } = jobCostFields(job);
    setCostsGrossStr(gross > 0 ? gross.toFixed(2) : "");
    setPlannedCostsStr(planned > 0 ? planned.toFixed(2) : "");
    // Zapisany plan wraca do pól — wycena nie ginie po wyjściu z kalkulatora.
    const p = job.plan?.input;
    if (!job.plan || !p) return;
    setUseBom(false);
    setAmountStr(p.amountGross.toFixed(2));
    setVatPct(String(Math.round(p.vatRate * 100)));
    setTaxForm(p.taxForm);
    setIsVatPayer(p.isVatPayer);
    if (p.isVatPayer) setCostsVatPct(String(Math.round(p.costsVatRate * 100)));
    setPitFlat(p.pitFlat);
    setTimeUnit("h");
    setHoursStr(p.hours > 0 ? String(p.hours) : "");
    setZusStr((p.socialMonthly + p.healthMinMonthly).toFixed(2));
    setWithInvoice(p.withInvoice);
    setDeductCostsVat(p.deductCostsVat);
    setReserveVacation(job.plan.reserveVacation ?? false);
    setReserveSick(job.plan.reserveSick ?? false);
  }

  // Zakłada klienta (jeśli nowy) i zlecenie, po czym wybiera je w polu „Zlecenie".
  // Wpisane kwoty zostają — nowe zlecenie nie ma jeszcze kosztów ani planu.
  async function createJobHere() {
    setNewJobPending(true);
    setNewJobError(undefined);
    try {
      const res = await createJobForQuoteAction({
        clientId: newClientId || undefined,
        clientName: newClientName,
        clientPhone: newClientPhone,
        title: newJobTitle,
        vatRate: isVatPayer && withInvoice ? vatRate : 0,
      });
      if (res.error || !res.job) {
        setNewJobError(res.error ?? "Nie udało się utworzyć zlecenia.");
        return;
      }
      const created: JobOption = {
        ...res.job,
        costs_net: 0,
        costs_vat: 0,
        materials_gross: 0,
        plan: null,
        plan_saved_at: null,
      };
      setCreatedJobs((prev) => [created, ...prev]);
      setJobId(created.id);
      setApplyError(undefined);
      setShowNewJob(false);
      setNewClientId("");
      setNewClientName("");
      setNewClientPhone("");
      setNewJobTitle("");
    } finally {
      setNewJobPending(false);
    }
  }

  async function applyToJob() {
    if (!jobId) return;
    const amountNum = parseAmount(amountStr) ?? 0;
    if (amountNum <= 0) {
      setApplyError("Wpisz kwotę zlecenia (brutto) większą od zera.");
      return;
    }
    setApplyPending(true);
    setApplyError(undefined);
    try {
      const snapshot: CalcQuote = {
        amountGross: amountNum,
        vatRate,
        withInvoice,
        costsGross,
        zus: zusForJob,
        rent: rentForJob,
        reserve: reserveAmount,
        hours,
        profit: netCashAfterReserves,
        savedAt: new Date().toISOString(),
        // Plan: materiały z wyceny (nie z faktur) + godziny i stawki z tej chwili.
        plan: {
          input: { ...profitInput, costsGross: plannedCosts > 0 ? plannedCosts : costsGross },
          targetRate,
          minRate,
          reserveVacation,
          reserveSick,
        },
      };
      const res = await applyQuoteToJobAction(jobId, amountNum, vatRate, snapshot);
      if (res.error) {
        setApplyError(res.error);
        return;
      }
      router.push(`/jobs/${jobId}`);
    } finally {
      setApplyPending(false);
    }
  }

  const selectedJob = jobId ? jobs.find((j) => j.id === jobId) : undefined;
  const amount = parseAmount(amountStr) ?? 0;
  const yearIncome = parseAmount(yearIncomeStr) ?? 0;
  const bomTotal = useBom
    ? bomLines.reduce((sum, l) => sum + (parseAmount(l.amountStr) ?? 0), 0)
    : 0;
  const costsGross = useBom ? bomTotal : (parseAmount(costsGrossStr) ?? 0);
  const vatRate = Math.max(0, Number(vatPct) / 100) || 0;
  const costsVatRate = isVatPayer ? Math.max(0, Number(costsVatPct) / 100) || 0 : 0;

  const timeValue = Math.max(0, parseAmount(hoursStr) ?? 0);
  const hours = timeUnit === "dni" ? timeValue * HOURS_PER_DAY : timeValue;
  // Wpisana kwota to społeczne + zdrowotna minimalna. Rachunek (lib/profitability) dostaje je
  // osobno, bo zdrowotna rośnie z dochodem, a społeczne obniżają podstawę PIT.
  const zusMonthly = Math.max(0, parseAmount(zusStr) ?? 0);
  const healthMinInZus = Math.min(healthMinMonthly, zusMonthly);
  const socialMonthly = zusMonthly - healthMinInZus;
  // Godziny PŁATNE w miesiącu: na nie rozkładają się ZUS i warsztat, z nich wynika stawka z celu.
  const hoursPerMonth = Math.max(1, parseAmount(hoursPerMonthStr) ?? 120);
  const rentMonthly = Math.max(0, parseAmount(rentStr) ?? 0);
  // Rezerwa: 26 dni urlopu × 8 h = 208 h, 10 dni L4 × 8 h = 80 h, na rok 1728 h produktywnych
  const reserveRatio = ((reserveVacation ? 208 : 0) + (reserveSick ? 80 : 0)) / 1728;

  const profitInput: JobProfitInput = {
    amountGross: amount,
    vatRate,
    isVatPayer,
    withInvoice,
    deductCostsVat,
    costsGross,
    costsVatRate,
    taxForm,
    yearIncomeBefore: yearIncome,
    pitFlat,
    hours,
    billableHoursMonth: hoursPerMonth,
    socialMonthly,
    healthMinMonthly: healthMinInZus,
    rentMonthly,
    reserveRatio,
  };
  const calc = calcJobProfit(profitInput);
  const result: CalcResult = {
    revenueNet: calc.revenueNet,
    revenueVat: calc.revenueVat,
    profit: calc.incomeBeforeTax,
    vatToPay: calc.vatToPay,
    pitDelta: calc.pit,
    netCash: calc.cashAfterTax,
  };
  const extraCosts = calc.costsNet;
  const extraCostsVat = calc.costsVat;
  const zusForJob = calc.zus;
  const rentForJob = calc.rent;
  const recoveredVat = calc.recoveredVat;
  const profitNoInvoice = calc.incomeBeforeTax;
  const netCashAfterZus = calc.cashAfterFixed;
  const reserveAmount = calc.reserve;
  const netCashAfterReserves = calc.netCash;
  const ratePerHour = calc.ratePerHour;
  const ratePerHourBeforeTaxes = calc.rateBeforeTax;

  // Cel: stawka na rękę z celu miesięcznego (np. 12 000 ÷ 120 h = 100 zł/h) albo wpisana ręcznie.
  const monthlyTarget = Math.max(0, parseAmount(monthlyTargetStr) ?? 0);
  const rateFromGoal = requiredHourlyRate(monthlyTarget, hoursPerMonth);
  const customTargetRate = parseAmount(targetRateStr) ?? 0;
  const targetRate = customTargetRate > 0 ? customTargetRate : rateFromGoal;
  const minRate = Math.max(0, parseAmount(minRateStr) ?? 0);
  const status = hours > 0 && amount > 0 ? rateStatus(ratePerHour, targetRate, minRate) : null;
  const targetCash = targetRate * hours;
  const priceTarget =
    hours > 0 && targetRate > 0 ? Math.ceil(requiredPriceGross(profitInput, targetCash)) : 0;
  const priceMin =
    hours > 0 && minRate > 0 ? Math.ceil(requiredPriceGross(profitInput, minRate * hours)) : 0;
  const priceHasVat = withInvoice && isVatPayer && vatRate > 0;
  const netOf = (gross: number) => (priceHasVat ? gross / (1 + vatRate) : gross);

  // Materiały: plan (wycena) a rzeczywistość (faktury) — ile zarobku zjadło przekroczenie.
  const plannedCosts = Math.max(0, parseAmount(plannedCostsStr) ?? 0);
  const plannedCalc =
    plannedCosts > 0 && Math.abs(plannedCosts - costsGross) > 0.005
      ? calcJobProfit({ ...profitInput, costsGross: plannedCosts })
      : null;

  // Rabat: cały rachunek od nowa dla niższej ceny (VAT, PIT, zdrowotna), nie proste odejmowanie.
  const discountValue = Math.max(0, parseAmount(discountStr) ?? 0);
  const discountAmount =
    discountMode === "pct"
      ? (amount * Math.min(100, discountValue)) / 100
      : Math.min(amount, discountValue);
  const discountCalc =
    discountAmount > 0 && amount > 0
      ? calcJobProfit({ ...profitInput, amountGross: amount - discountAmount })
      : null;
  const discountStatus =
    discountCalc && hours > 0 ? rateStatus(discountCalc.ratePerHour, targetRate, minRate) : null;

  return (
    <div className="flex flex-col gap-5">
      <Section title="Szablony">
        <div className="flex gap-2">
          <select
            value={templateId}
            onChange={(e) => loadTemplate(e.target.value)}
            className="input flex-1"
          >
            <option value="">— wybierz szablon —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {templateId && (
            <button
              type="button"
              onClick={() => deleteTemplate(templateId)}
              className="rounded-lg border border-red-200 text-red-600 text-xs px-3 active:bg-red-50"
              aria-label="Usuń szablon"
            >
              Usuń
            </button>
          )}
        </div>

        {!showSave ? (
          <button
            type="button"
            onClick={() => {
              setShowSave(true);
              setTemplateName("");
            }}
            className="rounded-lg border border-zinc-200 bg-white text-sm py-2 active:bg-zinc-50"
          >
            + Zapisz aktualne ustawienia jako szablon
          </button>
        ) : (
          <form action={saveAction} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
            <input type="hidden" name="amount_gross" value={amountStr || "0"} />
            <input type="hidden" name="vat_rate" value={(Number(vatPct) / 100).toString()} />
            <input type="hidden" name="costs_gross" value={costsGrossStr || "0"} />
            <input type="hidden" name="costs_vat_rate" value={(Number(costsVatPct) / 100).toString()} />
            <input type="hidden" name="tax_form" value={taxForm} />
            <input type="hidden" name="is_vat_payer" value={isVatPayer ? "true" : "false"} />
            <input
              name="name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="np. Szafa 3-drzwiowa dąb"
              required
              className="input"
            />
            {saveState.error && (
              <p className="text-xs text-red-600">{saveState.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savePending || !templateName.trim()}
                onClick={() => setShowSave(false)}
                className="flex-1 rounded-lg bg-accent text-white text-sm py-2 font-medium active:opacity-80 disabled:opacity-50"
              >
                {savePending ? "Zapisuję..." : "Zapisz"}
              </button>
              <button
                type="button"
                onClick={() => setShowSave(false)}
                className="rounded-lg border border-zinc-200 text-sm px-3 active:bg-zinc-50"
              >
                Anuluj
              </button>
            </div>
          </form>
        )}
      </Section>

      <Section title="Tryb rozliczenia">
        <div className="grid grid-cols-2 gap-2">
          <RadioCard
            checked={withInvoice}
            onChange={() => setWithInvoice(true)}
            label="Z fakturą"
            hint="VAT, PIT, ZUS"
          />
          <RadioCard
            checked={!withInvoice}
            onChange={() => setWithInvoice(false)}
            label="Bez faktury"
            hint="kasa do ręki"
          />
        </div>
        {!withInvoice && isVatPayer && (
          <label className="flex items-center gap-2 text-xs text-zinc-700 select-none mt-1">
            <input
              type="checkbox"
              checked={deductCostsVat}
              onChange={(e) => setDeductCostsVat(e.target.checked)}
            />
            <span>
              Odlicz VAT od kosztów (faktury kosztowe trafiają do JPK)
            </span>
          </label>
        )}
      </Section>

      <Section title="Kwota zlecenia">
        <Field label="Kwota brutto (PLN)">
          <input
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="np. 12300"
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stawka VAT (%)">
            <select
              value={vatPct}
              onChange={(e) => setVatPct(e.target.value)}
              className="input"
              disabled={!isVatPayer}
            >
              <option value="23">23%</option>
              <option value="8">8%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </Field>
          <Field label="VAT-owiec">
            <label className="flex items-center gap-2 h-[42px] px-3 rounded-lg border border-zinc-200 bg-white">
              <input
                type="checkbox"
                checked={isVatPayer}
                onChange={(e) => setIsVatPayer(e.target.checked)}
              />
              <span className="text-sm">{isVatPayer ? "Tak" : "Nie"}</span>
            </label>
          </Field>
        </div>
      </Section>

      <Section title="Koszty">
        <Field label="Zlecenie (opcjonalnie)">
          <select value={jobId} onChange={(e) => onJobChange(e.target.value)} className="input">
            <option value="">— bez przypisania —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.client_name})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500 mt-1">
            Po wyborze zlecenia koszty uzupełnią się automatycznie: z faktur kosztowych, a gdy ich brak — z pozycji wyceny. Możesz je nadpisać.
          </p>
        </Field>
        {!showNewJob ? (
          <button
            type="button"
            onClick={() => {
              setShowNewJob(true);
              setNewJobError(undefined);
            }}
            className="rounded-lg border border-zinc-200 bg-white text-sm py-2 active:bg-zinc-50"
          >
            + Nowy klient / nowe zlecenie
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
            <Field label="Klient">
              <select
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                className="input"
              >
                <option value="">— nowy klient —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {!newClientId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Imię i nazwisko / nazwa">
                  <input
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="np. Jan Kowalski"
                    className="input"
                  />
                </Field>
                <Field label="Telefon (opcjonalnie)">
                  <input
                    inputMode="tel"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="np. 600 100 200"
                    className="input"
                  />
                </Field>
              </div>
            )}
            <Field label="Nazwa zlecenia">
              <input
                value={newJobTitle}
                onChange={(e) => setNewJobTitle(e.target.value)}
                placeholder="np. Kuchnia"
                className="input"
              />
            </Field>
            {newJobError && <p className="text-xs text-red-600">{newJobError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={createJobHere}
                disabled={
                  newJobPending || !newJobTitle.trim() || (!newClientId && !newClientName.trim())
                }
                className="flex-1 rounded-lg bg-accent text-white text-sm py-2 font-medium active:opacity-80 disabled:opacity-50"
              >
                {newJobPending ? "Tworzę…" : "Utwórz zlecenie"}
              </button>
              <button
                type="button"
                onClick={() => setShowNewJob(false)}
                className="rounded-lg border border-zinc-200 text-sm px-3 active:bg-zinc-50"
              >
                Anuluj
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Zlecenie trafi na etap „Do wyceny”. Kwotę i plan zapisze przycisk „Przenieś wycenę do
              zlecenia” na dole.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Koszty brutto (PLN)">
            <input
              inputMode="decimal"
              value={useBom ? (bomTotal > 0 ? bomTotal.toFixed(2) : "") : costsGrossStr}
              onChange={(e) => setCostsGrossStr(e.target.value)}
              placeholder={useBom ? "z pozycji BOM" : "np. 5535"}
              className="input"
              disabled={useBom}
            />
          </Field>
          <Field label="VAT kosztów (%)">
            <select
              value={costsVatPct}
              onChange={(e) => setCostsVatPct(e.target.value)}
              className="input"
              disabled={!isVatPayer}
            >
              <option value="23">23%</option>
              <option value="8">8%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </Field>
        </div>
        {costsGross > 0 && (
          <p className="text-[11px] text-zinc-500 -mt-1">
            Netto: <span className="tabular-nums font-medium">{fmtPLN(extraCosts)}</span>
            {isVatPayer && (
              <>
                {" · VAT: "}
                <span className="tabular-nums font-medium">{fmtPLN(extraCostsVat)}</span>
              </>
            )}
          </p>
        )}

        <Field label="Koszty planowane brutto — z wyceny (opcjonalnie)">
          <input
            inputMode="decimal"
            value={plannedCostsStr}
            onChange={(e) => setPlannedCostsStr(e.target.value)}
            placeholder="np. 20000"
            className="input"
          />
          {plannedCosts > 0 && costsGross > 0 && (
            <span
              className={`text-[11px] ${
                costsGross > plannedCosts + 0.005 ? "text-red-600" : "text-zinc-500"
              }`}
            >
              Rzeczywiste względem planu: {costsGross >= plannedCosts ? "+" : "−"}
              {fmtPLN(Math.abs(costsGross - plannedCosts))} (
              {(((costsGross - plannedCosts) / plannedCosts) * 100).toFixed(1).replace(".", ",")}%)
            </span>
          )}
        </Field>

        <label className="flex items-center gap-2 text-xs text-zinc-700 select-none mt-1">
          <input
            type="checkbox"
            checked={useBom}
            onChange={(e) => {
              const v = e.target.checked;
              setUseBom(v);
              if (v && bomLines.length === 0) setBomLines([makeBomLine()]);
            }}
          />
          <span>Rozpisz koszty po pozycjach (BOM)</span>
        </label>

        {useBom && (
          <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
            {bomLines.map((line, idx) => (
              <div key={line.id} className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <input
                    list="bom-categories"
                    value={line.category}
                    onChange={(e) =>
                      setBomLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, category: e.target.value } : l))
                      )
                    }
                    placeholder="kategoria"
                    className="input"
                  />
                </div>
                <div className="w-28 shrink-0">
                  <input
                    inputMode="decimal"
                    value={line.amountStr}
                    onChange={(e) =>
                      setBomLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, amountStr: e.target.value } : l))
                      )
                    }
                    placeholder="brutto"
                    className="input text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBomLines((prev) =>
                      prev.length === 1 ? [makeBomLine()] : prev.filter((_, i) => i !== idx)
                    )
                  }
                  className="h-[42px] w-9 shrink-0 rounded-lg border border-zinc-200 text-zinc-500 active:bg-zinc-50"
                  aria-label="Usuń pozycję"
                >
                  ×
                </button>
              </div>
            ))}
            <datalist id="bom-categories">
              {materialCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => setBomLines((prev) => [...prev, makeBomLine()])}
              className="w-full rounded-lg border border-dashed border-zinc-300 text-sm py-2 text-zinc-600 active:bg-zinc-50"
            >
              + Dodaj pozycję
            </button>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs">
              <span className="text-zinc-500">Suma BOM (brutto)</span>
              <span className="tabular-nums font-semibold">{fmtPLN(bomTotal)}</span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Podatek dochodowy">
        <Field label="Forma opodatkowania">
          <div className="grid grid-cols-2 gap-2">
            <RadioCard
              checked={taxForm === "skala"}
              onChange={() => setTaxForm("skala")}
              label="Skala"
              hint="12% / 32%"
            />
            <RadioCard
              checked={taxForm === "liniowy"}
              onChange={() => setTaxForm("liniowy")}
              label="Liniowy"
              hint="19%"
            />
          </div>
        </Field>
        <Field label="Sposób liczenia PIT">
          <div className="grid grid-cols-2 gap-2">
            <RadioCard
              checked={!pitFlat}
              onChange={() => setPitFlat(false)}
              label="Z kwotą wolną"
              hint={taxForm === "skala" ? "30k wolne, próg 120k" : "Liniowy bez kwoty wolnej"}
            />
            <RadioCard
              checked={pitFlat}
              onChange={() => setPitFlat(true)}
              label="Bezpiecznie"
              hint={taxForm === "skala" ? "12% od 0 zł" : "19% od 0 zł"}
            />
          </div>
        </Field>
        {taxForm === "skala" && !pitFlat && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span>Dochód roczny dotychczas:</span>
              <span className="font-medium tabular-nums text-zinc-900">
                {fmtPLN(parseAmount(yearIncomeStr) ?? 0)}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              {yearIncomeOverride
                ? "Wartość ręczna."
                : defaultYearIncome > 0
                  ? "Pobrano automatycznie z dashboardu (YTD)."
                  : "Brak danych w bazie — wpisz ręcznie, jeśli chcesz."}
            </p>
            {!yearIncomeOverride ? (
              <button
                type="button"
                onClick={() => setYearIncomeOverride(true)}
                className="text-[11px] text-zinc-700 underline-offset-2 hover:underline"
              >
                Nadpisz ręcznie
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  inputMode="decimal"
                  value={yearIncomeStr}
                  onChange={(e) => setYearIncomeStr(e.target.value)}
                  placeholder="0"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    setYearIncomeOverride(false);
                    setYearIncomeStr(
                      defaultYearIncome > 0 ? defaultYearIncome.toFixed(2) : ""
                    );
                  }}
                  className="text-[11px] text-zinc-600 underline-offset-2 hover:underline"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Czas pracy i cel zarobku">
        <Field label="Czas pracy nad zleceniem">
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={hoursStr}
              onChange={(e) => setHoursStr(e.target.value)}
              placeholder={timeUnit === "dni" ? "np. 5" : "np. 40"}
              className="input flex-1"
            />
            <div className="flex shrink-0 rounded-lg border border-zinc-200 bg-white p-0.5">
              {(["h", "dni"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setTimeUnit(u)}
                  className={`px-3 rounded-md text-sm ${
                    timeUnit === u ? "bg-[#a06f3f] text-white font-medium" : "text-zinc-600"
                  }`}
                >
                  {u === "h" ? "godz." : "dni"}
                </button>
              ))}
            </div>
          </div>
          {timeUnit === "dni" && timeValue > 0 && (
            <span className="text-[11px] text-zinc-500">
              = {hours} h ({HOURS_PER_DAY} h / dzień)
            </span>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cel na rękę / mies. (PLN)">
            <input
              inputMode="decimal"
              value={monthlyTargetStr}
              onChange={(e) => setMonthlyTargetStr(e.target.value)}
              placeholder="12000"
              className="input"
            />
          </Field>
          <Field label="Godziny płatne / mies.">
            <input
              inputMode="decimal"
              value={hoursPerMonthStr}
              onChange={(e) => setHoursPerMonthStr(e.target.value)}
              placeholder="120"
              className="input"
            />
          </Field>
        </div>
        <p className="text-[11px] text-zinc-500 -mt-1">
          {fmtPLN(monthlyTarget)} ÷ {hoursPerMonth} h ={" "}
          <span className="font-medium tabular-nums text-zinc-700">{fmtRate(rateFromGoal)}</span> na rękę ·
          wykorzystanie {Math.round((hoursPerMonth / AVAILABLE_HOURS_MONTH) * 100)}% z{" "}
          {AVAILABLE_HOURS_MONTH} h. Reszta to przestoje, pomiary, wyceny i dojazdy — dlatego ZUS i
          warsztat rozkładają się tylko na godziny płatne.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-zinc-600">Stawka docelowa na rękę (zł/h)</span>
          <div className="flex flex-wrap gap-1.5">
            <RateChip
              label={`Z celu: ${Math.round(rateFromGoal)}`}
              active={customTargetRate <= 0}
              onPick={() => setTargetRateStr("")}
            />
            {RATE_PRESETS.map((r) => (
              <RateChip
                key={r}
                label={String(r)}
                active={customTargetRate === r}
                onPick={() => setTargetRateStr(String(r))}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Własna stawka docelowa">
              <input
                inputMode="decimal"
                value={targetRateStr}
                onChange={(e) => setTargetRateStr(e.target.value)}
                placeholder={`z celu: ${Math.round(rateFromGoal)}`}
                className="input"
              />
            </Field>
            <Field label="Stawka minimalna (zł/h)">
              <input
                inputMode="decimal"
                value={minRateStr}
                onChange={(e) => setMinRateStr(e.target.value)}
                placeholder="75"
                className="input"
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-zinc-600">Rezerwa wolnego (odejmowana od stawki)</span>
          <label className="flex items-center gap-2 text-sm text-zinc-700 select-none">
            <input
              type="checkbox"
              checked={reserveVacation}
              onChange={(e) => setReserveVacation(e.target.checked)}
            />
            <span>Urlop (26 dni × 8 h / rok)</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 select-none">
            <input
              type="checkbox"
              checked={reserveSick}
              onChange={(e) => setReserveSick(e.target.checked)}
            />
            <span>L4 (10 dni × 8 h / rok)</span>
          </label>
          {(reserveVacation || reserveSick) && hoursPerMonth < AVAILABLE_HOURS_MONTH && (
            <span className="text-[11px] text-amber-700">
              Uwaga na podwójne liczenie: godziny płatne ({hoursPerMonth} z {AVAILABLE_HOURS_MONTH})
              już zakładają przestoje. Zaznacz rezerwę tylko wtedy, gdy urlopu i L4 w nich nie ma.
            </span>
          )}
        </div>

        <Field label="Miesięczny ZUS ze zdrowotną (PLN)">
          <input
            inputMode="decimal"
            value={zusStr}
            onChange={(e) => setZusStr(e.target.value)}
            placeholder="0"
            className="input"
          />
          <span className="text-[11px] text-zinc-500">
            Dziś: {zusPhaseLabel}. W kwocie jest zdrowotna minimalna ({fmtPLN(healthMinMonthly)}/mies.).
            {withInvoice &&
              ` Gdy ${taxForm === "liniowy" ? "4,9%" : "9%"} dochodu ze zlecenia wychodzi więcej, różnica dolicza się sama.`}
          </span>
        </Field>
        <Field label="Warsztat — czynsz z prądem / mies. (PLN)">
          <input
            inputMode="decimal"
            value={rentStr}
            onChange={(e) => onRentChange(e.target.value)}
            placeholder="np. 300"
            className="input"
          />
          {rentMonthly > 0 && (
            <span className="text-[11px] text-zinc-500">
              ≈ {fmtPLN(rentMonthly / hoursPerMonth)} / h · {fmtPLN((rentMonthly / hoursPerMonth) * HOURS_PER_DAY)} / dzień
              {hours > 0 && <> · na to zlecenie: <span className="font-medium tabular-nums">{fmtPLN(rentForJob)}</span></>}
            </span>
          )}
        </Field>
        <div className="flex flex-wrap gap-1.5">
          <ZusPreset label="Ulga" amount={healthMinMonthly} onPick={setZusStr} />
          <ZusPreset label="Mały" amount={ZUS_SOCIAL_PREF_2026 + healthMinMonthly} onPick={setZusStr} />
          <ZusPreset label="Pełny" amount={ZUS_SOCIAL_FULL_2026 + healthMinMonthly} onPick={setZusStr} />
        </div>
        {!withInvoice && (
          <p className="text-[11px] text-zinc-500 -mt-1">
            ZUS i zdrowotną płacisz co miesiąc niezależnie od faktury, więc doliczamy ich część
            proporcjonalną do godzin także tutaj.
          </p>
        )}

        {hours > 0 && (
          <HourlyRatePanel
            withInvoice={withInvoice}
            hours={hours}
            zusForJob={zusForJob}
            socialForJob={calc.social}
            healthForJob={calc.health}
            status={status}
            targetRate={targetRate}
            minRate={minRate}
            rentForJob={rentForJob}
            rentMonthly={rentMonthly}
            hoursPerMonth={hoursPerMonth}
            netCash={result.netCash}
            netCashAfterZus={netCashAfterZus}
            netCashAfterReserves={netCashAfterReserves}
            reserveAmount={reserveAmount}
            reserveVacation={reserveVacation}
            reserveSick={reserveSick}
            ratePerHour={ratePerHour}
            ratePerHourBeforeTaxes={ratePerHourBeforeTaxes}
            amountGross={amount}
            costsGross={costsGross}
            recoveredVat={recoveredVat}
          />
        )}
      </Section>

      <ResultPanel
        result={result}
        amountGross={amount}
        costsGross={costsGross}
        costsNet={extraCosts}
        costsVat={extraCostsVat}
        isVatPayer={isVatPayer}
        withInvoice={withInvoice}
        profitNoInvoice={profitNoInvoice}
        recoveredVat={recoveredVat}
        zusForJob={zusForJob}
        rentForJob={rentForJob}
        reserveAmount={reserveAmount}
        netCashFinal={netCashAfterReserves}
        hours={hours}
        fixedMonthly={zusMonthly + rentMonthly}
      />

      {amount > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div
            className={`px-4 py-3 border-b ${
              status ? STATUS_TONE[status].box : "border-zinc-200 bg-zinc-50"
            }`}
          >
            <p
              className={`text-xs font-medium uppercase tracking-wide ${
                status ? STATUS_TONE[status].label : "text-zinc-600"
              }`}
            >
              Rentowność zlecenia · prognoza
            </p>
            {status ? (
              <p className={`text-sm font-semibold mt-0.5 ${STATUS_TONE[status].value}`}>
                {STATUS_TONE[status].text}: {fmtRate(ratePerHour)} na rękę
                <span className={`font-normal ${STATUS_TONE[status].sub}`}>
                  {" "}
                  · cel {fmtRate(targetRate)} · minimum {fmtRate(minRate)}
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Podaj czas pracy, żeby zobaczyć stawkę, cenę zalecaną i minimalną.
              </p>
            )}
          </div>

          <Row label="Cena brutto" value={fmtPLN(amount)} />
          {priceHasVat && <Row label="Netto (bez VAT)" value={fmtPLN(calc.revenueNet)} sub />}
          <Row label="Dochód przed podatkami" value={fmtPLN(calc.incomeBeforeTax)} sub />
          <Row label="Na rękę (po podatkach, ZUS, warsztacie)" value={fmtPLN(calc.netCash)} bold />

          {hours > 0 && targetRate > 0 && (
            <>
              <GroupHeader>Cel</GroupHeader>
              <Row
                label={`Cel na rękę (${fmtRate(targetRate)} × ${hours} h)`}
                value={fmtPLN(targetCash)}
              />
              <Row
                label={calc.netCash >= targetCash ? "Nadwyżka nad celem" : "Brakuje do celu"}
                value={fmtPLN(Math.abs(calc.netCash - targetCash))}
                sub
              />
              <Row label="Cena zalecana brutto" value={fmtPLN(priceTarget)} bold />
              {priceHasVat && <Row label="netto" value={fmtPLN(netOf(priceTarget))} sub />}
              {priceMin > 0 && (
                <>
                  <Row
                    label={`Cena minimalna brutto (${fmtRate(minRate)})`}
                    value={fmtPLN(priceMin)}
                  />
                  {priceHasVat && <Row label="netto" value={fmtPLN(netOf(priceMin))} sub />}
                  <Row
                    label="Zalecana − minimalna"
                    value={fmtPLN(priceTarget - priceMin)}
                    sub
                  />
                </>
              )}
              <Row
                label={
                  amount >= priceTarget
                    ? "Twoja cena ponad zalecaną"
                    : "Twoja cena poniżej zalecanej"
                }
                value={fmtPLN(Math.abs(amount - priceTarget))}
                sub
              />
            </>
          )}

          {plannedCalc && (
            <>
              <GroupHeader>Materiały: plan a rzeczywistość</GroupHeader>
              <Row label="Planowane brutto" value={fmtPLN(plannedCosts)} />
              <Row
                label={`Rzeczywiste brutto (${costsGross >= plannedCosts ? "+" : "−"}${Math.abs(
                  ((costsGross - plannedCosts) / plannedCosts) * 100,
                )
                  .toFixed(1)
                  .replace(".", ",")}%)`}
                value={fmtPLN(costsGross)}
              />
              <Row
                label={
                  plannedCalc.netCash >= calc.netCash
                    ? "Utracony zarobek na rękę"
                    : "Dodatkowy zarobek na rękę"
                }
                value={fmtPLN(Math.abs(plannedCalc.netCash - calc.netCash))}
                bold
              />
              {hours > 0 && (
                <Row
                  label="Stawka przy kosztach z planu"
                  value={fmtRate(plannedCalc.ratePerHour)}
                  sub
                />
              )}
            </>
          )}

          <GroupHeader>Symulacja rabatu</GroupHeader>
          <div className="flex gap-2 px-4 py-3 border-b border-zinc-100">
            <input
              inputMode="decimal"
              value={discountStr}
              onChange={(e) => setDiscountStr(e.target.value)}
              placeholder={discountMode === "pct" ? "np. 5" : "np. 1500"}
              aria-label="Rabat"
              className="input flex-1"
            />
            <div className="flex shrink-0 rounded-lg border border-zinc-200 bg-white p-0.5">
              {(["zl", "pct"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDiscountMode(m)}
                  className={`px-3 rounded-md text-sm ${
                    discountMode === m ? "bg-[#a06f3f] text-white font-medium" : "text-zinc-600"
                  }`}
                >
                  {m === "zl" ? "zł" : "%"}
                </button>
              ))}
            </div>
          </div>
          {discountCalc && (
            <>
              <Row
                label={`Cena po rabacie brutto (− ${fmtPLN(discountAmount)})`}
                value={fmtPLN(amount - discountAmount)}
              />
              <Row
                label="Spadek zarobku na rękę"
                value={`− ${fmtPLN(calc.netCash - discountCalc.netCash)}`}
                sub
              />
              <Row label="Na rękę po rabacie" value={fmtPLN(discountCalc.netCash)} bold />
              {hours > 0 && (
                <>
                  <Row
                    label={`Stawka po rabacie (było ${fmtRate(ratePerHour)})`}
                    value={fmtRate(discountCalc.ratePerHour)}
                  />
                  <Row
                    label={
                      discountCalc.netCash >= targetCash ? "Nadal ponad celem o" : "Do celu brakuje"
                    }
                    value={fmtPLN(Math.abs(discountCalc.netCash - targetCash))}
                    sub
                  />
                  {discountStatus && (
                    <div className={`px-4 py-2.5 text-sm font-medium ${STATUS_TONE[discountStatus].box} ${STATUS_TONE[discountStatus].value}`}>
                      {discountStatus === "ponizej"
                        ? `Po rabacie schodzisz poniżej minimum ${fmtRate(minRate)}.`
                        : discountStatus === "minimum"
                          ? `Po rabacie nadal powyżej minimum, ale poniżej celu.`
                          : `Po rabacie cel nadal osiągnięty.`}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      {jobId && (
        <div className="rounded-xl border border-[#ededea] bg-white p-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={applyToJob}
            disabled={applyPending || amount <= 0}
            className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-[#a06f3f] hover:bg-[#7d5530] active:opacity-90 transition-colors disabled:opacity-50"
          >
            <span>
              {applyPending ? "Przenoszę…" : "Przenieś wycenę do zlecenia"}
            </span>
            <span aria-hidden>→</span>
          </button>
          {applyError && (
            <p className="text-xs text-red-600">{applyError}</p>
          )}
          <div className="text-[11px] text-[#8d8a85] space-y-0.5">
            <div className="flex justify-between"><span>Kwota zlecenia</span><span className="tabular-nums text-[#3a3633] font-medium">{fmtPLN(amount)}</span></div>
            <div className="flex justify-between"><span>Koszty</span><span className="tabular-nums">{fmtPLN(costsGross)}</span></div>
            {zusForJob > 0 && <div className="flex justify-between"><span>ZUS (część zlecenia)</span><span className="tabular-nums">{fmtPLN(zusForJob)}</span></div>}
            {rentForJob > 0 && <div className="flex justify-between"><span>Warsztat (czynsz + prąd)</span><span className="tabular-nums">{fmtPLN(rentForJob)}</span></div>}
            {reserveAmount > 0 && <div className="flex justify-between"><span>Rezerwa urlop/L4</span><span className="tabular-nums">{fmtPLN(reserveAmount)}</span></div>}
            <div className="flex justify-between pt-0.5 border-t border-[#f0efec]"><span>Zysk na czysto</span><span className="tabular-nums text-[#3a6b4d] font-semibold">{fmtPLN(netCashAfterReserves)}</span></div>
          </div>
          <p className="text-[10px] text-[#b3b0aa]">
            Ta wycena (kwota, koszty, ZUS, warsztat, urlop, zysk) pojawi się na karcie zlecenia 1:1.
            Razem z nią zapisuje się plan:{" "}
            {hours > 0 ? `${hours} h` : "bez godzin — wpisz czas pracy"}, materiały{" "}
            {fmtPLN(plannedCosts > 0 ? plannedCosts : costsGross)}, cel {fmtRate(targetRate)}. Zlecenie
            porówna go potem z licznikiem i fakturami.
          </p>
          {selectedJob?.plan_saved_at && (
            <p className="text-[10px] text-[#a18653]">
              To zlecenie ma już plan z {fmtDate(selectedJob.plan_saved_at)} — jest wczytany powyżej.
              Przeniesienie zastąpi go obecnymi danymi.
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-zinc-500 text-center">
        To prognoza, nie porada podatkowa: PIT, ZUS i zdrowotna liczone wg stawek 2026 dla tego
        jednego zlecenia. Rozliczenie roczne może wyjść inaczej — skonsultuj z księgową.
      </p>

      <style jsx>{`
        .input {
          width: 100%;
          height: 42px;
          padding: 0 12px;
          border-radius: 0.5rem;
          border: 1px solid #e4e4e7;
          background: white;
          font-size: 16px;
        }
        .input:focus {
          outline: 2px solid #1f1d1b;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

function ZusPreset({
  label,
  amount,
  onPick,
}: {
  label: string;
  amount: number;
  onPick: (s: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(amount.toFixed(2))}
      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 active:bg-zinc-50"
    >
      {label}: {fmtPLN(amount)}
    </button>
  );
}

function RateChip({
  label,
  active,
  onPick,
}: {
  label: string;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`rounded-md border px-2.5 py-1.5 text-xs tabular-nums ${
        active
          ? "border-[#a06f3f] bg-[#a06f3f] text-white font-medium"
          : "border-zinc-200 bg-white text-zinc-600 active:bg-zinc-50"
      }`}
    >
      {label}
    </button>
  );
}

function HourlyRatePanel({
  withInvoice,
  hours,
  zusForJob,
  socialForJob,
  healthForJob,
  status,
  targetRate,
  minRate,
  rentForJob,
  rentMonthly,
  hoursPerMonth,
  netCash,
  netCashAfterZus,
  netCashAfterReserves,
  reserveAmount,
  reserveVacation,
  reserveSick,
  ratePerHour,
  ratePerHourBeforeTaxes,
  amountGross,
  costsGross,
  recoveredVat,
}: {
  withInvoice: boolean;
  hours: number;
  zusForJob: number;
  socialForJob: number;
  healthForJob: number;
  status: RateStatus | null;
  targetRate: number;
  minRate: number;
  rentForJob: number;
  rentMonthly: number;
  hoursPerMonth: number;
  netCash: number;
  netCashAfterZus: number;
  netCashAfterReserves: number;
  reserveAmount: number;
  reserveVacation: boolean;
  reserveSick: boolean;
  ratePerHour: number;
  ratePerHourBeforeTaxes: number;
  amountGross: number;
  costsGross: number;
  recoveredVat: number;
}) {
  const tone = STATUS_TONE[status ?? (ratePerHour >= 0 ? "cel" : "ponizej")];
  const zusLabel = `− ZUS i zdrowotna (społeczne ${fmtPLN(socialForJob)} + zdrowotna ${fmtPLN(healthForJob)})`;
  const reserveActive = reserveVacation || reserveSick;
  const reserveLabel = [reserveVacation ? "urlop" : null, reserveSick ? "L4" : null]
    .filter(Boolean)
    .join(" + ");
  const tagBase = withInvoice
    ? `po VAT, PIT, ZUS${rentForJob > 0 ? " i warsztacie" : ""}`
    : `kwota − koszty − ZUS${rentForJob > 0 ? " − warsztat" : ""} (gotówka)`;
  const rentRow = rentForJob > 0 && (
    <Row
      label={`− Warsztat (${fmtPLN(rentMonthly)}/${hoursPerMonth}h × ${hours}h)`}
      value={`− ${fmtPLN(rentForJob)}`}
      sub
    />
  );
  return (
    <div className="space-y-2">
      <div className={`rounded-2xl border p-4 ${tone.box}`}>
        <p className={`text-xs font-medium uppercase tracking-wide ${tone.label}`}>
          Stawka na rękę / godzinę {withInvoice ? "" : "(bez faktury)"}
        </p>
        <p className={`text-3xl font-bold tabular-nums mt-1 ${tone.value}`}>
          {fmtPLN(ratePerHour)}
        </p>
        <p className={`text-[11px] mt-1 ${tone.sub}`}>
          {hours} h · {reserveActive ? `${tagBase}, po rezerwie ${reserveLabel}` : tagBase}
        </p>
        {status && (
          <p className={`text-[11px] mt-0.5 font-medium ${tone.label}`}>
            {tone.text} · cel {fmtRate(targetRate)} · minimum {fmtRate(minRate)}
          </p>
        )}
        {/* Ta sama stawka przeliczona na miesiąc: pełne 160 h i godziny płatne z ustawień. */}
        <div className={`mt-3 pt-3 border-t border-black/10 grid grid-cols-2 gap-3 ${tone.value}`}>
          <div>
            <p className={`text-[11px] ${tone.sub}`}>Miesięcznie przy {AVAILABLE_HOURS_MONTH} h</p>
            <p className="text-lg font-semibold tabular-nums">
              {fmtPLN(ratePerHour * AVAILABLE_HOURS_MONTH)}
            </p>
          </div>
          {hoursPerMonth !== AVAILABLE_HOURS_MONTH && (
            <div>
              <p className={`text-[11px] ${tone.sub}`}>przy {hoursPerMonth} h płatnych</p>
              <p className="text-lg font-semibold tabular-nums">{fmtPLN(ratePerHour * hoursPerMonth)}</p>
            </div>
          )}
        </div>
      </div>

      <details className="rounded-xl border border-zinc-200 bg-white overflow-hidden group">
        <summary className="flex items-center justify-between px-4 py-3 text-sm text-zinc-700 cursor-pointer select-none active:bg-zinc-50 list-none">
          <span className="font-medium">Pokaż rozliczenie godzinowe</span>
          <span className="text-xs text-zinc-400 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="border-t border-zinc-100">
          {withInvoice ? (
            <>
              <Row label="Na czysto (po VAT, PIT)" value={fmtPLN(netCash)} />
              <Row label={zusLabel} value={`− ${fmtPLN(zusForJob)}`} sub />
              {rentRow}
              <Row label={rentForJob > 0 ? "= Na rękę po ZUS i warsztacie" : "= Na rękę po ZUS"} value={fmtPLN(netCashAfterZus)} bold />
              {reserveActive && (
                <Row
                  label={`− Rezerwa ${reserveLabel}`}
                  value={`− ${fmtPLN(reserveAmount)}`}
                  sub
                />
              )}
              {reserveActive && (
                <Row label="= Po rezerwie" value={fmtPLN(netCashAfterReserves)} bold />
              )}
              <Row label="Stawka brutto/h (przed PIT)" value={fmtPLN(ratePerHourBeforeTaxes)} sub />
              <Row label="Stawka na rękę/h" value={fmtPLN(ratePerHour)} highlight />
            </>
          ) : (
            <>
              <Row label="Kwota od klienta (gotówka)" value={fmtPLN(amountGross)} />
              <Row label="− Koszty brutto" value={`− ${fmtPLN(costsGross)}`} sub />
              {recoveredVat > 0 && (
                <Row
                  label="+ VAT do odzyskania (z JPK)"
                  value={`+ ${fmtPLN(recoveredVat)}`}
                  sub
                />
              )}
              <Row label={zusLabel} value={`− ${fmtPLN(zusForJob)}`} sub />
              {rentRow}
              <Row label={rentForJob > 0 ? "= Do kieszeni po ZUS i warsztacie" : "= Do kieszeni po ZUS"} value={fmtPLN(netCashAfterZus)} bold />
              {reserveActive && (
                <Row
                  label={`− Rezerwa ${reserveLabel}`}
                  value={`− ${fmtPLN(reserveAmount)}`}
                  sub
                />
              )}
              {reserveActive && (
                <Row label="= Po rezerwie" value={fmtPLN(netCashAfterReserves)} bold />
              )}
              <Row label="Stawka na rękę/h" value={fmtPLN(ratePerHour)} highlight />
            </>
          )}
        </div>
      </details>
    </div>
  );
}

function RadioCard({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`rounded-lg border p-3 text-left active:bg-zinc-50 ${
        checked ? "border-accent bg-zinc-50" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-zinc-500">{hint}</div>
    </button>
  );
}

function ResultPanel({
  result,
  amountGross,
  costsGross,
  costsNet,
  costsVat,
  isVatPayer,
  withInvoice,
  profitNoInvoice,
  recoveredVat,
  zusForJob,
  rentForJob,
  reserveAmount,
  netCashFinal,
  hours,
  fixedMonthly,
}: {
  result: CalcResult;
  amountGross: number;
  costsGross: number;
  costsNet: number;
  costsVat: number;
  isVatPayer: boolean;
  withInvoice: boolean;
  profitNoInvoice: number;
  recoveredVat: number;
  zusForJob: number;
  rentForJob: number;
  reserveAmount: number;
  netCashFinal: number;
  hours: number;
  fixedMonthly: number;
}) {
  const { revenueNet, revenueVat, profit, vatToPay, pitDelta, netCash } = result;
  const taxTotal = vatToPay + pitDelta;
  const empty = amountGross === 0 && costsGross === 0;
  // Kwota „na rękę" PRZED odjęciem ZUS/rezerw (po VAT+PIT gdy z fakturą).
  const cashBeforeZus = withInvoice ? netCash : profitNoInvoice;
  // Finalna „na czysto" = po ZUS i rezerwach (spójnie z panelem stawki /h).
  const displayCash = netCashFinal;
  const recovered = recoveredVat > 0;
  const hasDeductions = zusForJob > 0 || rentForJob > 0 || reserveAmount > 0;
  const zusNeedsHours = fixedMonthly > 0 && hours === 0;

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          {withInvoice ? "Na czysto (po VAT, PIT, ZUS)" : "Na czysto (gotówka, po ZUS)"}
        </p>
        <p className="text-3xl font-bold tabular-nums text-emerald-900 mt-1">
          {fmtPLN(displayCash)}
        </p>
        {!withInvoice && !hasDeductions && (
          <p className="text-[11px] text-emerald-700/80 mt-1">
            {recovered
              ? "kwota − koszty + zwrot VAT · brak PIT"
              : "kwota − koszty · brak VAT i PIT"}
          </p>
        )}
        {hasDeductions && (
          <div className="mt-2 pt-2 border-t border-emerald-200/70 space-y-0.5 text-[11px] text-emerald-800/90">
            <div className="flex items-baseline justify-between">
              <span>{withInvoice ? "Po VAT i PIT" : "Kwota − koszty"}</span>
              <span className="tabular-nums">{fmtPLN(cashBeforeZus)}</span>
            </div>
            {zusForJob > 0 && (
              <div className="flex items-baseline justify-between">
                <span>− ZUS i zdrowotna</span>
                <span className="tabular-nums">− {fmtPLN(zusForJob)}</span>
              </div>
            )}
            {rentForJob > 0 && (
              <div className="flex items-baseline justify-between">
                <span>− Warsztat (czynsz + prąd)</span>
                <span className="tabular-nums">− {fmtPLN(rentForJob)}</span>
              </div>
            )}
            {reserveAmount > 0 && (
              <div className="flex items-baseline justify-between">
                <span>− Rezerwa wolnego</span>
                <span className="tabular-nums">− {fmtPLN(reserveAmount)}</span>
              </div>
            )}
          </div>
        )}
        {zusNeedsHours && (
          <p className="text-[11px] text-amber-700 mt-1.5">
            Podaj „Czas pracy nad zleceniem”, aby rozłożyć na zlecenie koszty stałe: ZUS, minimalną zdrowotną i warsztat.
          </p>
        )}
      </div>

      {withInvoice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
              Razem podatki {isVatPayer ? "(VAT + PIT)" : "(PIT)"}
            </p>
            <p className="text-xl font-semibold tabular-nums text-amber-900">
              {fmtPLN(taxTotal)}
            </p>
          </div>
          <div className="mt-2 space-y-1 text-xs text-amber-900/80">
            {isVatPayer && (
              <div className="flex items-baseline justify-between">
                <span>VAT do zapłaty</span>
                <span className="tabular-nums">{fmtPLN(vatToPay)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span>PIT (przyrost roczny)</span>
              <span className="tabular-nums">{fmtPLN(pitDelta)}</span>
            </div>
          </div>
        </div>
      )}

      {!empty && (
        <details className="rounded-xl border border-zinc-200 bg-white overflow-hidden group">
          <summary className="flex items-center justify-between px-4 py-3 text-sm text-zinc-700 cursor-pointer select-none active:bg-zinc-50 list-none">
            <span className="font-medium">Pokaż szczegóły wyliczenia</span>
            <span className="text-xs text-zinc-400 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="border-t border-zinc-100">
            {withInvoice ? (
              <>
                <GroupHeader>Sprzedaż</GroupHeader>
                <Row label="Brutto (z VAT)" value={fmtPLN(amountGross)} />
                {isVatPayer && <Row label="− VAT należny" value={fmtPLN(revenueVat)} sub />}
                <Row
                  label={isVatPayer ? "= Netto (po VAT)" : "Netto"}
                  value={fmtPLN(revenueNet)}
                />
                <GroupHeader>Koszty</GroupHeader>
                <Row label="Brutto" value={fmtPLN(costsGross)} />
                {isVatPayer && <Row label="− VAT naliczony" value={fmtPLN(costsVat)} sub />}
                <Row
                  label={isVatPayer ? "= Netto (do PIT)" : "Netto"}
                  value={fmtPLN(costsNet)}
                />
                <GroupHeader>Zysk</GroupHeader>
                <Row label="Zysk netto" value={fmtPLN(profit)} bold />
                <Row label="Podstawa do PIT" value={fmtPLN(Math.max(0, profit))} sub />
                <GroupHeader>Na rękę</GroupHeader>
                <Row label="Na czysto (po VAT i PIT)" value={fmtPLN(netCash)} />
                {zusForJob > 0 && (
                  <Row label="− ZUS i zdrowotna" value={`− ${fmtPLN(zusForJob)}`} sub />
                )}
                {rentForJob > 0 && (
                  <Row label="− Warsztat (czynsz + prąd)" value={`− ${fmtPLN(rentForJob)}`} sub />
                )}
                {reserveAmount > 0 && (
                  <Row label="− Rezerwa wolnego" value={`− ${fmtPLN(reserveAmount)}`} sub />
                )}
                {hasDeductions && <Row label="= Na czysto (po ZUS)" value={fmtPLN(displayCash)} bold />}
              </>
            ) : (
              <>
                <GroupHeader>Gotówka</GroupHeader>
                <Row label="Kwota od klienta" value={fmtPLN(amountGross)} />
                <Row label="− Koszty brutto" value={`− ${fmtPLN(costsGross)}`} sub />
                {recovered && (
                  <Row
                    label="+ VAT do odzyskania (z JPK)"
                    value={`+ ${fmtPLN(recoveredVat)}`}
                    sub
                  />
                )}
                <Row
                  label={hasDeductions ? "= Przed ZUS" : "= Do kieszeni"}
                  value={fmtPLN(profitNoInvoice)}
                  bold={!hasDeductions}
                />
                {zusForJob > 0 && (
                  <Row label="− ZUS i zdrowotna" value={`− ${fmtPLN(zusForJob)}`} sub />
                )}
                {rentForJob > 0 && (
                  <Row label="− Warsztat (czynsz + prąd)" value={`− ${fmtPLN(rentForJob)}`} sub />
                )}
                {reserveAmount > 0 && (
                  <Row label="− Rezerwa wolnego" value={`− ${fmtPLN(reserveAmount)}`} sub />
                )}
                {hasDeductions && <Row label="= Na czysto" value={fmtPLN(displayCash)} bold />}
              </>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 bg-zinc-50 border-b border-zinc-100">
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  sub = false,
  negative = false,
  highlight = false,
  tax = false,
  bold = false,
}: {
  label: string;
  value: string;
  sub?: boolean;
  negative?: boolean;
  highlight?: boolean;
  tax?: boolean;
  bold?: boolean;
}) {
  const bg = highlight ? "bg-emerald-50" : tax ? "bg-amber-50" : bold ? "bg-zinc-50" : "";
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-zinc-100 ${bg}`}
    >
      <span className={`text-sm ${sub ? "text-zinc-500" : "text-zinc-700"}`}>{label}</span>
      <span
        className={`tabular-nums ${
          highlight
            ? "text-emerald-700 text-lg font-semibold"
            : tax
              ? "text-amber-800 text-lg font-semibold"
              : bold
                ? "text-zinc-900 text-base font-semibold"
                : negative
                  ? "text-zinc-700 font-medium"
                  : "text-zinc-900 font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
