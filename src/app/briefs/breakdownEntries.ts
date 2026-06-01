// Wspólna logika wpisów "rozbicia po typie" (zawiasy / siłowniki).
// UI komponentów różni się, ale hydracja JSON i serializacja są identyczne.

export type BreakdownEntry = { type: string; count: string };

/** Wartość count z JSON może być liczbą lub stringiem — normalizujemy do string. */
export function coerceCount(raw: unknown): string {
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw;
  return "";
}

/**
 * Buduje hidden-input JSON i sumę z wpisów.
 * requireType: pomija wpisy bez nazwy typu (siłowniki mają wolne pole typu;
 * zawiasy mają typ zawsze ustawiony z listy).
 */
export function serializeBreakdown(
  entries: BreakdownEntry[],
  opts: { requireType?: boolean } = {}
): { json: string; total: number } {
  const trimmed = entries
    .map((e) => ({ type: e.type.trim(), count: Number(e.count) }))
    .filter(
      (e) =>
        (!opts.requireType || e.type !== "") &&
        Number.isFinite(e.count) &&
        e.count > 0
    );
  const json = trimmed.length > 0 ? JSON.stringify(trimmed) : "";
  const total = trimmed.reduce((sum, e) => sum + e.count, 0);
  return { json, total };
}
