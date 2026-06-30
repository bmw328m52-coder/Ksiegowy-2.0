// Mapowanie klucza grupy wyceny → sugerowane kategorie w cenniku.
// Komponent picker pokaże te kategorie najpierw, pozostałe niżej.
// Klucze grup pochodzą z `groupSlug(title)` lub z `GROUP_SUBPRICES` w page.tsx.

export const GROUP_CATEGORIES: Record<string, string[]> = {
  // Fronty (sub-grupy)
  fronty_lakier: ["Fronty lakierowane MDF (JUKA)"],
  fronty_uchwyty: ["Uchwyty"],

  // Okucia (sub-grupy)
  okucia_zawiasy: ["Zawiasy"],
  okucia_silowniki: ["Aventos", "Siłowniki"],
  okucia_tip_on: ["Tip-on", "Tip-on Blumotion"],
  // "Szuflady" = gotowe zestawy (na górze pickera). Luźne części ("Szuflady — części")
  // celowo nie sugerowane, żeby nie wypychały zestawów — wciąż dostępne przez wyszukiwarkę.
  okucia_szuflady: ["Szuflady"],
  okucia_magic_corner: ["Magic corner", "Cargo narożne"],
  okucia_cargo: ["Kosze cargo wysokie", "Cargo narożne"],
  okucia_nogi: ["Nogi", "Nogi i cokoły"],

  // Główne grupy (klucze ze slug tytułu)
  korpusy_i_okleina: ["Płyty laminowane", "Obrzeża ABS"],
  blat: ["Blaty"],
  agd_do_zabudowy: ["AGD"],
  oswietlenie_led: ["LED", "Profile LED"],

  drzwi_i_fronty: ["Fronty lakierowane MDF (JUKA)", "Drzwi przesuwne", "Uchwyty"],
  korpusy_i_wnetrze: ["Płyty laminowane", "Akcesoria szafy"],
  oswietlenie: ["LED", "Profile LED"],

  szafki_i_fronty: ["Fronty lakierowane MDF (JUKA)", "Uchwyty", "Płyty laminowane"],
  blat_umywalka: ["Blaty", "Umywalki"],
  oswietlenie_i_dodatki: ["LED", "Profile LED", "Akcesoria łazienkowe"],
};

export function suggestedCategoriesFor(groupKey: string): string[] {
  return GROUP_CATEGORIES[groupKey] ?? [];
}
