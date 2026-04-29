export type TaxForm = "skala" | "liniowy";

export const PIT_FREE_AMOUNT = 30_000;
export const PIT_BRACKET = 120_000;
export const PIT_RATE_LOW = 0.12;
export const PIT_RATE_HIGH = 0.32;
export const PIT_RATE_LINEAR = 0.19;

export function pitSkala(annualIncome: number): number {
  const income = Math.max(0, annualIncome);
  if (income <= PIT_FREE_AMOUNT) return 0;
  if (income <= PIT_BRACKET) return (income - PIT_FREE_AMOUNT) * PIT_RATE_LOW;
  const lowPart = (PIT_BRACKET - PIT_FREE_AMOUNT) * PIT_RATE_LOW;
  return lowPart + (income - PIT_BRACKET) * PIT_RATE_HIGH;
}

export function pitLiniowy(annualIncome: number): number {
  return Math.max(0, annualIncome) * PIT_RATE_LINEAR;
}

export function pitFor(form: TaxForm, annualIncome: number): number {
  return form === "skala" ? pitSkala(annualIncome) : pitLiniowy(annualIncome);
}

export type CalcInput = {
  amountGross: number;
  vatRate: number;
  costsNet: number;
  costsVat: number;
  taxForm: TaxForm;
  isVatPayer: boolean;
  yearIncomeBefore: number;
};

export type CalcResult = {
  revenueNet: number;
  revenueVat: number;
  profit: number;
  vatToPay: number;
  pitDelta: number;
  netCash: number;
};

export function calcDeal(input: CalcInput): CalcResult {
  const { amountGross, vatRate, costsNet, costsVat, taxForm, isVatPayer, yearIncomeBefore } = input;

  const revenueNet = isVatPayer ? amountGross / (1 + vatRate) : amountGross;
  const revenueVat = isVatPayer ? amountGross - revenueNet : 0;

  const effectiveCosts = isVatPayer ? costsNet : costsNet + costsVat;
  const profit = revenueNet - effectiveCosts;

  const vatToPay = isVatPayer ? Math.max(0, revenueVat - costsVat) : 0;

  const pitBefore = pitFor(taxForm, Math.max(0, yearIncomeBefore));
  const pitAfter = pitFor(taxForm, Math.max(0, yearIncomeBefore + Math.max(0, profit)));
  const pitDelta = Math.max(0, pitAfter - pitBefore);

  const netCash = profit - pitDelta;

  return { revenueNet, revenueVat, profit, vatToPay, pitDelta, netCash };
}
