// Odczyt e-faktury ustrukturyzowanej FA(2)/FA(3) z KSeF. Struktura jest płaska
// i przewidywalna, więc wystarczy lekki parser po nazwach elementów — bez
// zależności. Obsługuje opcjonalny prefiks przestrzeni nazw (np. <tns:P_7>).

export type FaLine = {
  name: string;
  qty: number | null;
  unit: string | null;
  net: number;
  vat: number;
  gross: number;
  vatRate: number | null; // 0.23; null = zw / np / oo
};

export type FaInvoice = {
  sellerName: string | null;
  paymentDue: string | null;
  paid: boolean;
  paidDate: string | null;
  paymentMethod: string | null;
  isCorrection: boolean;
  lines: FaLine[];
};

const PAYMENT_FORMS: Record<string, string> = {
  "1": "gotówka",
  "2": "karta",
  "3": "bon",
  "4": "czek",
  "5": "kredyt",
  "6": "przelew",
  "7": "mobilna",
};

function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "g");
  return [...xml.matchAll(re)].map((m) => m[1]);
}

function field(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`);
  const m = xml.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}

function num(xml: string, tag: string): number | null {
  const v = field(xml, tag);
  if (v === null || v === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function rateOf(p12: string | null): number | null {
  if (!p12) return null;
  const n = Number(p12.trim());
  if (Number.isFinite(n)) return n / 100;
  return p12.startsWith("0") ? 0 : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseFa(xml: string): FaInvoice {
  const seller = blocks(xml, "Podmiot1")[0] ?? "";
  const fa = blocks(xml, "Fa")[0] ?? xml;
  const platnosc = blocks(fa, "Platnosc")[0] ?? "";
  const rodzaj = field(fa, "RodzajFaktury") ?? "";
  const isCorrection = rodzaj.startsWith("KOR");

  const lines: FaLine[] = [];
  for (const w of blocks(fa, "FaWiersz")) {
    // W korektach wiersze „stan przed" są informacyjne — liczymy tylko różnice/stan po.
    if (field(w, "StanPrzed") === "1") continue;
    const vatRate = rateOf(field(w, "P_12"));
    const netField = num(w, "P_11");
    const grossField = num(w, "P_11A");
    const vatField = num(w, "P_11Vat");
    let net: number;
    let vat: number;
    if (netField !== null) {
      net = netField;
      vat = vatField ?? round2(net * (vatRate ?? 0));
    } else if (grossField !== null) {
      // Faktura liczona od brutto (art. 106e ust. 7–8)
      vat = vatField ?? round2(grossField - grossField / (1 + (vatRate ?? 0)));
      net = round2(grossField - vat);
    } else {
      continue;
    }
    lines.push({
      name: field(w, "P_7") ?? "Pozycja faktury",
      qty: num(w, "P_8B"),
      unit: field(w, "P_8A"),
      net: round2(net),
      vat: round2(vat),
      gross: round2(net + vat),
      vatRate,
    });
  }

  const termin = blocks(platnosc, "TerminPlatnosci")[0];
  const forma = field(platnosc, "FormaPlatnosci");

  return {
    sellerName: field(blocks(seller, "DaneIdentyfikacyjne")[0] ?? seller, "Nazwa"),
    paymentDue: termin ? field(termin, "Termin") : null,
    paid: field(platnosc, "Zaplacono") === "1",
    paidDate: field(platnosc, "DataZaplaty"),
    paymentMethod: forma ? (PAYMENT_FORMS[forma] ?? null) : null,
    isCorrection,
    lines,
  };
}
