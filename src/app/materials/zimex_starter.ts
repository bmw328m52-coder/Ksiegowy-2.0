import type { StarterItem } from "./mercury_starter";

// Materiał Zimex — formatki cięte + oklejane (płyty, HDF, blaty, obrzeża).
// Kategorie zgodne z GROUP_CATEGORIES (wycena): "Płyty laminowane" i "Obrzeża ABS"
// wpinają się pod grupę „Korpusy i okleina", "Blaty" pod „Blat".
// Ceny to WARTOŚCI WYJŚCIOWE (brutto) — biała płyta i oklejanie z realnych stawek
// hurtowni, reszta oznaczona „sprawdź". Wszystko edytowalne w Cenniku.
// Import jest nieniszczący: pomija pozycje o istniejącej już nazwie.

export const ZIMEX_STARTER: StarterItem[] = [
  {
    name: "Płyta laminowana 18 mm — biała (korpusy)",
    unit: "m2",
    default_price_gross: 46.9,
    category: "Płyty laminowane",
    notes: "Cena hurtowa brutto /m² (formatka cięta).",
  },
  {
    name: "Płyta laminowana 18 mm — dekor/kolor (korpusy)",
    unit: "m2",
    default_price_gross: 46.9,
    category: "Płyty laminowane",
    notes: "Cena wyjściowa = jak biała — popraw dla konkretnego dekoru.",
  },
  {
    name: "HDF 3 mm — plecy / dna szuflad",
    unit: "m2",
    default_price_gross: 18.0,
    category: "Płyty laminowane",
    notes: "Cena wyjściowa — sprawdź w Zimex.",
  },
  {
    name: "Blat laminowany 38 mm",
    unit: "mb",
    default_price_gross: 130.0,
    category: "Blaty",
    notes: "Cena wyjściowa — sprawdź grubość/dekor.",
  },
  {
    name: "Obrzeże ABS 0,8 mm — oklejanie (all-in)",
    unit: "mb",
    default_price_gross: 6.8,
    category: "Obrzeża ABS",
    notes: "Stawka all-in oklejania /mb.",
  },
];
