// Dostawcy Artura (LUVIANO) — używani do grupowania listy zakupów per klient.
// Zimex = materiał (formatki cięte+oklejane, blaty, HDF, obrzeża),
// Mercury = akcesoria meblowe (zawiasy, prowadnice, uchwyty, nogi),
// JUKA = fronty lakierowane MDF, Design Light = oświetlenie LED (producent),
// Belmeb = rezerwa, Inne = nieprzypisane.

export const SUPPLIERS = ["Zimex", "Mercury", "JUKA", "Design Light", "Belmeb", "Peka", "Nomet", "Rejs", "Inne"] as const;
export type Supplier = (typeof SUPPLIERS)[number];

// Kolejność wyświetlania na liście zakupów (Inne zawsze na końcu).
export const SUPPLIER_ORDER: Supplier[] = ["Zimex", "Mercury", "JUKA", "Design Light", "Belmeb", "Peka", "Nomet", "Rejs", "Inne"];

// Rabaty wynegocjowane per dostawca (ułamek, 0.15 = 15%). Ceny w cenniku to ceny
// katalogowe sklepu; realny koszt zakupu Artura = cena × (1 − rabat). Dotyczy tylko
// akcesoriów — Mercury (sklep.merkuryam.pl), rabat 15% od 2026-06-09. Materiał (Zimex)
// i fronty (JUKA) Artur bierze gdzie indziej, więc ich ceny zostają bez zmian.
export const SUPPLIER_DISCOUNT: Partial<Record<Supplier, number>> = {
  Mercury: 0.15,
};

// Rabat dostawcy jako ułamek (0 gdy brak). Realny koszt = cena × (1 − discountFor).
export function discountFor(supplier: Supplier): number {
  return SUPPLIER_DISCOUNT[supplier] ?? 0;
}

function isSupplier(v: string): v is Supplier {
  return (SUPPLIERS as readonly string[]).includes(v);
}

// Domyślny dostawca wywnioskowany z kategorii lub nazwy pozycji cennika,
// gdy pozycja nie ma jawnie ustawionego dostawcy.
const KEYWORD_SUPPLIER: { match: RegExp; supplier: Supplier }[] = [
  { match: /design.?light|ta[śs]ma led|pasek led|profil.*led|zasilacz.*led|o[śs]wietlenie led|z[łl][ąa]czka.*led/i, supplier: "Design Light" },
  { match: /\bpeka\b|dispensa|convoy/i, supplier: "Peka" },
  { match: /\bnomet\b/i, supplier: "Nomet" },
  { match: /\brejs\b|multi variant/i, supplier: "Rejs" },
  { match: /front.*lakier|juka/i, supplier: "JUKA" },
  {
    match: /zawias|prowadnic|uchwyt|\bnog|aventos|si[łl]ownik|tip.?on|szuflad|legrabox|tandembox|magic|cargo|okuci/i,
    supplier: "Mercury",
  },
  {
    match: /p[łl]yt|obrze[żz]|blat|[śs]cian|hdf|korpus|laminow|melamin/i,
    supplier: "Zimex",
  },
];

export function supplierFromText(...parts: (string | null | undefined)[]): Supplier | null {
  const text = parts.filter(Boolean).join(" ");
  if (!text) return null;
  for (const r of KEYWORD_SUPPLIER) if (r.match.test(text)) return r.supplier;
  return null;
}

// Ustala dostawcę pozycji: jawny z cennika ma pierwszeństwo, potem heurystyka
// z kategorii/nazwy, na końcu "Inne".
export function resolveSupplier(
  explicit: string | null | undefined,
  category?: string | null,
  name?: string | null
): Supplier {
  const e = (explicit ?? "").trim();
  if (e) return isSupplier(e) ? e : "Inne";
  return supplierFromText(category, name) ?? "Inne";
}
