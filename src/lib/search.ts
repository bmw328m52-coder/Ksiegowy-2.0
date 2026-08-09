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
