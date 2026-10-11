import type { TaxForm } from "./tax";

// ============================================================
// ZUS przedsiębiorcy — wyliczanie fazy i kwoty do zapłaty
// na podstawie daty rozpoczęcia działalności.
//
// STAŁE 2026 — zaktualizuj rocznie (ZUS ogłasza w styczniu/lutym):
//   - preferencyjny (30% min. wynagrodzenia) społeczne z chorobowym
//   - pełny (60% prognozowanego przeciętnego) społeczne + Fundusz Pracy
//   - minimalna zdrowotna = 9% minimalnego wynagrodzenia
// ============================================================

/** Część SPOŁECZNA w fazie preferencyjnej (Mały ZUS), z chorobowym. 2026. */
export const ZUS_SOCIAL_PREF_2026 = 456.18;
/** Część SPOŁECZNA w pełnym ZUS (duży ZUS), z chorobowym + Fundusz Pracy. 2026. */
export const ZUS_SOCIAL_FULL_2026 = 1926.76;
/** Minimalna miesięczna składka zdrowotna. 2026 (9% z 4806 zł). */
export const HEALTH_MIN_2026 = 432.54;

/** Stopa zdrowotnej — skala podatkowa. */
export const HEALTH_RATE_SKALA = 0.09;
/** Stopa zdrowotnej — podatek liniowy. */
export const HEALTH_RATE_LINIOWY = 0.049;

export type ZusPhase = "before" | "ulga" | "preferencyjny" | "pelny";

export const ZUS_PHASE_LABELS: Record<ZusPhase, string> = {
  before: "Przed rozpoczęciem",
  ulga: "Ulga na start",
  preferencyjny: "Preferencyjny ZUS",
  pelny: "Pełny ZUS",
};

function absMonth(year: number, monthIdx: number): number {
  return year * 12 + monthIdx;
}

function fromAbs(abs: number): { year: number; monthIdx: number } {
  const year = Math.floor(abs / 12);
  const monthIdx = ((abs % 12) + 12) % 12;
  return { year, monthIdx };
}

/**
 * Faza ZUS dla danego miesiąca rozliczeniowego.
 *
 * Ulga na start: 6 pełnych miesięcy kalendarzowych. Jeśli działalność
 * rozpoczęto 1. dnia miesiąca — ten miesiąc się liczy jako pełny; w innym
 * wypadku pierwszy (niepełny) miesiąc też jest objęty ulgą, a 6 pełnych
 * miesięcy liczy się od kolejnego miesiąca.
 * Preferencyjny (Mały ZUS): kolejne 24 miesiące.
 * Potem: pełny ZUS.
 */
export function zusPhaseForMonth(
  startDate: string | null | undefined,
  year: number,
  monthIdx: number,
): ZusPhase {
  if (!startDate) return "pelny"; // brak daty → zakładamy pełny (bezpiecznie)
  const d = new Date(startDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "pelny";

  const startAbs = absMonth(d.getFullYear(), d.getMonth());
  const target = absMonth(year, monthIdx);
  if (target < startAbs) return "before";

  const firstFullMonth = d.getDate() === 1 ? startAbs : startAbs + 1;
  const ulgaEndExclusive = firstFullMonth + 6;
  const prefEndExclusive = ulgaEndExclusive + 24;

  if (target < ulgaEndExclusive) return "ulga";
  if (target < prefEndExclusive) return "preferencyjny";
  return "pelny";
}

export type ZusPhaseBoundaries = {
  /** Ostatni miesiąc ulgi na start (pierwszy dzień tego miesiąca). */
  ulgaLastMonth: { year: number; monthIdx: number };
  /** Ostatni miesiąc preferencyjnego ZUS. */
  prefLastMonth: { year: number; monthIdx: number };
  /** Pierwszy miesiąc pełnego ZUS. */
  fullFirstMonth: { year: number; monthIdx: number };
};

/** Granice faz do wyświetlenia w podglądzie (kiedy kończy się ulga / preferencyjny). */
export function zusPhaseBoundaries(startDate: string): ZusPhaseBoundaries | null {
  const d = new Date(startDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const startAbs = absMonth(d.getFullYear(), d.getMonth());
  const firstFullMonth = d.getDate() === 1 ? startAbs : startAbs + 1;
  const ulgaEndExclusive = firstFullMonth + 6;
  const prefEndExclusive = ulgaEndExclusive + 24;
  return {
    ulgaLastMonth: fromAbs(ulgaEndExclusive - 1),
    prefLastMonth: fromAbs(prefEndExclusive - 1),
    fullFirstMonth: fromAbs(prefEndExclusive),
  };
}

/** Część społeczna ZUS dla danej fazy (stałe 2026, z opcjonalnym nadpisaniem). */
export function zusSocialForPhase(
  phase: ZusPhase,
  opts?: { socialPref?: number; socialFull?: number },
): number {
  const pref = opts?.socialPref ?? ZUS_SOCIAL_PREF_2026;
  const full = opts?.socialFull ?? ZUS_SOCIAL_FULL_2026;
  switch (phase) {
    case "before":
      return 0;
    case "ulga":
      return 0; // ulga na start = brak składek społecznych
    case "preferencyjny":
      return pref;
    case "pelny":
      return full;
  }
}

/**
 * Składka zdrowotna za miesiąc. Liczona z dochodu (zysku) miesiąca,
 * nie mniej niż ustalone minimum.
 * Skala: 9% dochodu. Liniowy: 4,9% dochodu.
 */
export function healthForMonth(
  taxForm: TaxForm,
  monthIncome: number,
  minHealth: number = HEALTH_MIN_2026,
): number {
  const income = Math.max(0, monthIncome);
  const rate = taxForm === "liniowy" ? HEALTH_RATE_LINIOWY : HEALTH_RATE_SKALA;
  return Math.max(minHealth, income * rate);
}

export type ZusMonth = {
  phase: ZusPhase;
  social: number;
  health: number;
  total: number;
};

/** Pełne wyliczenie ZUS za miesiąc: część społeczna (wg fazy) + zdrowotna (z dochodu). */
export function zusForMonth(params: {
  startDate: string | null | undefined;
  year: number;
  monthIdx: number;
  taxForm: TaxForm;
  monthIncome: number;
  minHealth?: number;
  socialPref?: number;
  socialFull?: number;
}): ZusMonth {
  const phase = zusPhaseForMonth(params.startDate, params.year, params.monthIdx);
  const social = zusSocialForPhase(phase, {
    socialPref: params.socialPref,
    socialFull: params.socialFull,
  });
  const health =
    phase === "before"
      ? 0
      : healthForMonth(params.taxForm, params.monthIncome, params.minHealth ?? HEALTH_MIN_2026);
  return { phase, social, health, total: social + health };
}
