// Licznik czasu: z marży na godzinę → ile zostaje na rękę.
// Czysta funkcja (bez bazy), wspólna dla podsumowania i licznika na żywo.

export type NetRateParams = {
  /** Godziny produktywne w miesiącu, na które rozkładają się koszty stałe. */
  hours: number;
  /** Składki społeczne miesięcznie (ulga na start = 0). */
  social: number;
  /** Minimalna zdrowotna miesięcznie. */
  healthMin: number;
  /** Średnie koszty firmy bez zlecenia, miesięcznie. */
  fixed: number;
  /** Stawka PIT od pierwszej złotówki (skala 12%, liniowy 19%) — ostrożnie, bez kwoty wolnej. */
  pitRate: number;
  /** Stopa składki zdrowotnej od dochodu. */
  healthRate: number;
};

/**
 * Na rękę za godzinę = marża/h − koszty stałe − ZUS − podatek dochodowy − zdrowotna od dochodu.
 * `taxed` = false dla zleceń bez faktury (bez PIT i zdrowotnej ponad minimum).
 */
export function netRate(rate: number | null, taxed: boolean, p: NetRateParams): number | null {
  if (rate === null) return null;
  const h = Math.max(1, p.hours);
  const afterFixed = rate - (p.fixed + p.social + p.healthMin) / h;
  if (!taxed) return afterFixed;
  // Podstawa PIT i zdrowotnej: dochód po kosztach firmy i składkach społecznych.
  const base = Math.max(0, rate - (p.fixed + p.social) / h);
  const pit = base * p.pitRate;
  const healthExtra = Math.max(0, base * p.healthRate - p.healthMin / h);
  return afterFixed - pit - healthExtra;
}
