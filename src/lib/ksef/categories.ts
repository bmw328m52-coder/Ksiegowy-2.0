// Podpowiedź kategorii po dostawcy i nazwie pozycji — Artur może ją zmienić.
// Kolejność ma znaczenie: pierwsza pasująca reguła wygrywa.
export const CATEGORY_RULES: { match: RegExp; category: string }[] = [
  { match: /orlen|\bbp\b|shell|circle\s?k|moya|lotos|amic|olej nap|benzyn|\bpb\s?95|\blpg\b|paliw/i, category: "paliwo" },
  {
    match:
      /frezark|ukośnic|ukosnic|pilark|pi[łl]a\b|szlifierk|odkurzacz|wkr[eę]tark|wiertark|wiert[łl]|lamello|ścisk|scisk|st[oó][łl] warsztat|przyssawk|odci[aą]g|szyna prowadz|poziomic|kozio[łl]|kobył|szablon|tarcz|\bfrez\b|frez hm|p[łl]ytka wymienn|k[aą]tomierz|marker|zatyczk|szczelinomierz|ogranicznik|przymiar|podp[oó]rk|dystans do regul|makita|festool|dewalt|narz[eę]dz|pakdrew|bajdrew|ka-?meb/i,
    category: "narzędzia",
  },
  { match: /laptop|ipad|tablet|telefon|ładowark|ladowark|charger|\b3mk\b|toner|\btusz|\bhp \d|doładowan|doladowan/i, category: "biuro" },
  { match: /zimex|juka|fronty? (meblow|akryl|lakier)|oklejan|ci[eę]ci[ea] p[łl]yt|p[łl]yt|formatk|hdf|mdf|blat|obrze|okleina|laminat|sklejk|drewn/i, category: "płyty/drewno" },
  { match: /mercury|merkury|blum|hettich|grass|zawias|prowadnic|uchwyt|aventos|legrabox|tandembox|okuci|n[oó][żz]k|cargo|merivobox|mocowanie frontu|tip-?on|prowadnik clip/i, category: "okucia" },
  { match: /design.?light|ta[śs]ma led|zasilacz|castorama|leroy|obi\b|bricoman|wkr[eę]t|klej|silikon|tasma|ta[śs]m/i, category: "materiały" },
  { match: /transport|przesy[łl]k|kurier|dostaw|inpost|dpd|\bdhl\b/i, category: "transport" },
  { match: /orange|t-mobile|ksi[eę]gow|biuro|papier|toner|abonament/i, category: "biuro" },
];

export function guessCategory(supplier: string | null, lineNames: string[]): string | null {
  const text = [supplier ?? "", ...lineNames].join(" ");
  return CATEGORY_RULES.find((r) => r.match.test(text))?.category ?? null;
}
