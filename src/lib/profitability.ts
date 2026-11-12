import { pitFor, PIT_RATE_LOW, PIT_RATE_LINEAR, type TaxForm } from "./tax";
import { HEALTH_RATE_LINIOWY, HEALTH_RATE_SKALA } from "./zus";

// ============================================================
// Rentowność zlecenia — jedno miejsce, które liczy drogę
// „cena brutto → netto (bez VAT) → dochód przed podatkami → na rękę".
// Czyste funkcje (bez Reacta i bazy), żeby dało się je testować:
//   npm run test:calc
// Wszystkie wyniki to PROGNOZA — stawki PIT/ZUS siedzą w tax.ts i zus.ts.
// ============================================================

export type JobProfitInput = {
  /** Cena dla klienta brutto. */
  amountGross: number;
  /** Stawka VAT sprzedaży (0.08, 0.23…). */
  vatRate: number;
  isVatPayer: boolean;
  /** false = „bez faktury": brak VAT i PIT, kwota − koszty. */
  withInvoice: boolean;
  /** Tylko bez faktury: VAT z faktur kosztowych i tak odliczany w JPK. */
  deductCostsVat: boolean;
  costsGross: number;
  costsVatRate: number;
  taxForm: TaxForm;
  /** Dochód narastająco w roku przed tym zleceniem (progi skali). */
  yearIncomeBefore: number;
  /** true → płaska stawka od pierwszej złotówki, bez kwoty wolnej. */
  pitFlat: boolean;
  /** Godziny pracy nad zleceniem. */
  hours: number;
  /** Godziny płatne w miesiącu — na nie rozkładają się koszty stałe. */
  billableHoursMonth: number;
  /** Składki społeczne miesięcznie (ulga na start = 0). */
  socialMonthly: number;
  /** Minimalna zdrowotna miesięcznie. */
  healthMinMonthly: number;
  /** Warsztat (czynsz + prąd) miesięcznie. */
  rentMonthly: number;
  /** Rezerwa urlop/L4 jako ułamek kwoty na rękę (0 = brak). */
  reserveRatio: number;
};

export type JobProfitResult = {
  revenueNet: number;
  revenueVat: number;
  costsNet: number;
  costsVat: number;
  vatToPay: number;
  /** VAT z kosztów odzyskany w trybie bez faktury. */
  recoveredVat: number;
  /** Dochód przed podatkami: sprzedaż netto − koszty netto (bez faktury: kwota − koszty). */
  incomeBeforeTax: number;
  pit: number;
  /** Po VAT i PIT, przed ZUS/warsztatem/rezerwą. */
  cashAfterTax: number;
  social: number;
  health: number;
  /** social + health. */
  zus: number;
  rent: number;
  /** Po ZUS i warsztacie, przed rezerwą. */
  cashAfterFixed: number;
  reserve: number;
  /** Na rękę — to, co faktycznie zostaje. */
  netCash: number;
  /** Na rękę ÷ godziny (0 gdy brak godzin). */
  ratePerHour: number;
  /** Dochód przed podatkami ÷ godziny. */
  rateBeforeTax: number;
};

export function calcJobProfit(input: JobProfitInput): JobProfitResult {
  const hours = Math.max(0, input.hours);
  const perMonth = Math.max(1, input.billableHoursMonth);
  const share = hours / perMonth;
  const social = Math.max(0, input.socialMonthly) * share;
  const rent = Math.max(0, input.rentMonthly) * share;
  const healthMin = Math.max(0, input.healthMinMonthly) * share;

  const costsVatRate = input.isVatPayer ? Math.max(0, input.costsVatRate) : 0;
  const costsNet = input.costsGross / (1 + costsVatRate);
  const costsVat = input.costsGross - costsNet;

  let revenueNet = input.amountGross;
  let revenueVat = 0;
  let vatToPay = 0;
  let recoveredVat = 0;
  let incomeBeforeTax: number;
  let pit = 0;
  let health = healthMin;

  if (input.withInvoice) {
    if (input.isVatPayer) {
      revenueNet = input.amountGross / (1 + Math.max(0, input.vatRate));
      revenueVat = input.amountGross - revenueNet;
      vatToPay = Math.max(0, revenueVat - costsVat);
    }
    incomeBeforeTax = revenueNet - costsNet;
    // Podstawa PIT i zdrowotnej: dochód pomniejszony o składki społeczne.
    const base = Math.max(0, incomeBeforeTax - social);
    if (input.pitFlat) {
      pit = base * (input.taxForm === "skala" ? PIT_RATE_LOW : PIT_RATE_LINEAR);
    } else {
      const before = Math.max(0, input.yearIncomeBefore);
      pit = Math.max(0, pitFor(input.taxForm, before + base) - pitFor(input.taxForm, before));
    }
    const healthRate = input.taxForm === "liniowy" ? HEALTH_RATE_LINIOWY : HEALTH_RATE_SKALA;
    health = Math.max(healthMin, base * healthRate);
  } else {
    recoveredVat = input.isVatPayer && input.deductCostsVat ? costsVat : 0;
    incomeBeforeTax = input.amountGross - input.costsGross + recoveredVat;
  }

  const cashAfterTax = incomeBeforeTax - pit;
  const zus = social + health;
  const cashAfterFixed = cashAfterTax - zus - rent;
  const reserve = cashAfterFixed * Math.max(0, input.reserveRatio);
  const netCash = cashAfterFixed - reserve;

  return {
    revenueNet,
    revenueVat,
    costsNet,
    costsVat,
    vatToPay,
    recoveredVat,
    incomeBeforeTax,
    pit,
    cashAfterTax,
    social,
    health,
    zus,
    rent,
    cashAfterFixed,
    reserve,
    netCash,
    ratePerHour: hours > 0 ? netCash / hours : 0,
    rateBeforeTax: hours > 0 ? incomeBeforeTax / hours : 0,
  };
}

/**
 * Cena brutto, przy której na rękę zostaje `targetNetCash`.
 * Liczone „pod prąd" przez pełny rachunek (VAT, PIT z progami, zdrowotna),
 * a nie przez proste dodawanie — dlatego bisekcja.
 */
export function requiredPriceGross(
  input: Omit<JobProfitInput, "amountGross">,
  targetNetCash: number,
): number {
  const net = (amountGross: number) => calcJobProfit({ ...input, amountGross }).netCash;
  let lo = 0;
  let hi = Math.max(1000, input.costsGross * 2);
  while (net(hi) < targetNetCash && hi < 1e9) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (net(mid) < targetNetCash) lo = mid;
    else hi = mid;
  }
  return hi;
}

export type RateStatus = "cel" | "minimum" | "ponizej";

/** Zielony = cel osiągnięty, żółty = między minimum a celem, czerwony = poniżej minimum. */
export function rateStatus(rate: number, targetRate: number, minRate: number): RateStatus {
  if (rate >= targetRate) return "cel";
  if (rate >= minRate) return "minimum";
  return "ponizej";
}

/** Wymagana stawka na rękę, żeby z godzin płatnych wyszedł miesięczny cel. */
export function requiredHourlyRate(monthlyTarget: number, billableHoursMonth: number): number {
  return billableHoursMonth > 0 ? Math.max(0, monthlyTarget) / billableHoursMonth : 0;
}

// ============================================================
// Plan zlecenia a wykonanie.
// Plan = dane rachunku z chwili wyceny, zapisane na zleceniu (jobs.calc_quote.plan).
// Wykonanie = godziny z licznika i koszty z faktur, liczone TYM SAMYM rachunkiem.
// ============================================================

export type JobPlan = {
  /** Dane rachunku z wyceny: costsGross = planowane materiały, hours = planowane godziny. */
  input: JobProfitInput;
  /** Stawka docelowa i minimalna na rękę (zł/h) obowiązujące przy wycenie. */
  targetRate: number;
  minRate: number;
  reserveVacation?: boolean;
  reserveSick?: boolean;
};

export type PlanActuals = {
  /** Aktualna kwota zlecenia brutto (0 = bierz z planu). */
  amountGross: number;
  /** Godziny z licznika i wpisów ręcznych. */
  hours: number;
  /** Koszty z przypiętych faktur, brutto (0 = brak faktur). */
  costsGross: number;
  /** Zamontowane/rozliczone: liczymy to, co jest. W toku: nie mniej niż plan. */
  finished: boolean;
};

export type PlanVsActual = {
  planned: JobProfitResult;
  actual: JobProfitResult;
  /** Godziny i koszty przyjęte do wyniku „actual". */
  hoursUsed: number;
  costsUsed: number;
  /** true = wartość wzięta z planu (brak danych albo zlecenie w toku poniżej planu). */
  hoursFromPlan: boolean;
  costsFromPlan: boolean;
  plannedStatus: RateStatus | null;
  actualStatus: RateStatus | null;
  /** Cena brutto, która przy faktycznych godzinach i kosztach dałaby stawkę docelową. */
  priceForTarget: number;
};

export function planVsActual(plan: JobPlan, actuals: PlanActuals): PlanVsActual {
  const planHours = Math.max(0, plan.input.hours);
  const planCosts = Math.max(0, plan.input.costsGross);
  const hours = Math.max(0, actuals.hours);
  const costs = Math.max(0, actuals.costsGross);

  // W toku godziny i faktury dopiero przyrastają — do prognozy bierzemy nie mniej niż plan.
  const hoursUsed = actuals.finished ? (hours > 0 ? hours : planHours) : Math.max(hours, planHours);
  const costsUsed = actuals.finished ? (costs > 0 ? costs : planCosts) : Math.max(costs, planCosts);

  const actualInput: JobProfitInput = {
    ...plan.input,
    amountGross: actuals.amountGross > 0 ? actuals.amountGross : plan.input.amountGross,
    hours: hoursUsed,
    costsGross: costsUsed,
  };
  const planned = calcJobProfit(plan.input);
  const actual = calcJobProfit(actualInput);
  const status = (r: JobProfitResult, h: number) =>
    h > 0 && plan.targetRate > 0 ? rateStatus(r.ratePerHour, plan.targetRate, plan.minRate) : null;

  return {
    planned,
    actual,
    hoursUsed,
    costsUsed,
    hoursFromPlan: hoursUsed !== hours,
    costsFromPlan: costsUsed !== costs,
    plannedStatus: status(planned, planHours),
    actualStatus: status(actual, hoursUsed),
    priceForTarget:
      hoursUsed > 0 && plan.targetRate > 0
        ? requiredPriceGross(actualInput, plan.targetRate * hoursUsed)
        : 0,
  };
}
