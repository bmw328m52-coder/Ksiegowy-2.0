// Wspólne wyszukiwanie dla cennika (strona /materials i picker w wycenie).
// Normalizacja: małe litery, bez polskich znaków i diakrytyków.
// Dopasowanie PO SŁOWACH — każde słowo zapytania musi wystąpić w tekście
// (niekoniecznie obok siebie), więc „front dąb" znajdzie „Front MDF dąb sonoma".

export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    // Usuń łączące znaki diakrytyczne (U+0300–U+036F).
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Zwraca true, gdy każde słowo z `query` występuje w `haystack`
 * (po normalizacji). Puste zapytanie pasuje do wszystkiego.
 */
export function matchesSearch(haystack: string, query: string): boolean {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = normalizeSearch(haystack);
  return tokens.every((t) => hay.includes(t));
}

/**
 * Ranking trafnosci dla pickerow z katalogu — scisly: KAZDE wpisane slowo musi
 * wystepowac w nazwie (albo w kategorii/dostawcy, ale to wypada nizej). Brak rozmytego dopasowania.
 * Im mniejszy wynik, tym wyzej:
 *  0 nazwa = zapytanie · 1 nazwa zaczyna sie od zapytania · 2 jakies slowo nazwy zaczyna sie od zapytania
 *  3 kazde slowo zapytania zaczyna jakies slowo nazwy · 4 kazde slowo gdziekolwiek w nazwie
 *  5 kazde slowo gdziekolwiek w nazwie/kategorii/dostawcy
 * Zwraca null, gdy pozycja nie pasuje.
 */
export function searchRank(name: string, extra: string, query: string): number | null {
  const q = normalizeSearch(query).trim().replace(/\s+/g, " ");
  if (!q) return 0;
  const tokens = q.split(" ");
  const n = normalizeSearch(name);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (words.some((w) => w.startsWith(q))) return 2;
  if (n.includes(` ${q}`) || n.includes(`-${q}`) || n.includes(`/${q}`)) return 2;
  if (tokens.every((t) => words.some((w) => w.startsWith(t)))) return 3;
  if (tokens.every((t) => n.includes(t))) return 4;
  const all = `${n} ${normalizeSearch(extra)}`;
  if (tokens.every((t) => all.includes(t))) return 5;
  return null;
}

/** Filtruje i sortuje pozycje wg trafnosci; remis: krotsza nazwa, potem alfabetycznie. */
export function rankByQuery<T>(items: T[], query: string, get: (t: T) => { name: string; extra: string }): T[] {
  const scored: { t: T; r: number; name: string }[] = [];
  for (const t of items) {
    const { name, extra } = get(t);
    const r = searchRank(name, extra, query);
    if (r !== null) scored.push({ t, r, name });
  }
  scored.sort((a, b) => a.r - b.r || a.name.length - b.name.length || a.name.localeCompare(b.name, "pl"));
  return scored.map((x) => x.t);
}
