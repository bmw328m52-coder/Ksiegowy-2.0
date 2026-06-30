// Kurowany cennik akcesoriów Mercury (Merkury AM) — sklep.merkuryam.pl
// Ceny brutto PLN pobrane 2026-06-02. Warianty kolorystyczne (biały/szary/antracyt)
// o identycznej cenie zwinięte do jednej pozycji — kolor dopisany w nazwie.
// Drobnica < ~2 zł (zaślepki, pojedyncze prowadniki) pominięta.
// Wszystkie pozycje: supplier = "Mercury".

export type StarterItem = {
  name: string;
  unit: string;
  default_price_gross: number;
  category: string;
  notes?: string;
};

export const MERCURY_STARTER: StarterItem[] = [
  // ---------- Zawiasy Blum ----------
  { name: "Zawias Blum 71B3550 Blumotion Clip-T 110° (z amortyzacją)", unit: "szt", default_price_gross: 12.29, category: "Zawiasy" },
  { name: "Zawias Blum 71B3580 Blumotion Clip-T 110° ze sprężyną", unit: "szt", default_price_gross: 12.71, category: "Zawiasy" },
  { name: "Zawias Blum 71T3550 Clip-T 110° (bez amortyzacji)", unit: "szt", default_price_gross: 6.17, category: "Zawiasy" },
  { name: "Zawias Blum 70T3550 Clip-T 110° bez sprężyny", unit: "szt", default_price_gross: 6.53, category: "Zawiasy" },
  { name: "Zawias równoległy wpuszczany Blum 79T9550 Clip-T 95°", unit: "szt", default_price_gross: 9.88, category: "Zawiasy" },
  { name: "Zawias Blum 70T7500NTL Clip-T 155° do TIP-ON, onyks", unit: "szt", default_price_gross: 19.42, category: "Zawiasy" },
  { name: "Prowadnik krzyżakowy z regulacją wysokości Blum 173L8100 0mm", unit: "szt", default_price_gross: 1.30, category: "Zawiasy" },
  { name: "Prowadnik krzyżakowy mimośrodowy Blum 173H7100 0mm", unit: "szt", default_price_gross: 2.14, category: "Zawiasy" },

  // ---------- Amortyzatory Blumotion ----------
  { name: "Amortyzator Blumotion Blum 973A0500 zintegrowany", unit: "szt", default_price_gross: 6.69, category: "Amortyzatory" },
  { name: "Amortyzator Blumotion Blum 973A6000 na zawias 170°", unit: "szt", default_price_gross: 10.50, category: "Amortyzatory" },
  { name: "Amortyzator Blumotion Blum 970.1002 do drzwi", unit: "szt", default_price_gross: 5.18, category: "Amortyzatory" },

  // ============================================================
  // SZUFLADY — taksonomia kategorii:
  //   • "Szuflady"          → gotowe ZESTAWY Merivobox (to klikamy w wycenie, sekcja niżej)
  //   • "Szuflady — części" → luźne komponenty (boki, prowadnice, relingi, boxcap, mocowania,
  //                            uchwyty, fronty wewn., Movento, sprzęgło) — schodzą pod zestawy
  //   • "Wkłady szuflad"    → wkłady (Orga-Line) jako osobny dodatek
  // ============================================================

  // ---------- Merivobox — boki szuflady (część, kolor: biały/szary/antracyt) ----------
  { name: "Boki Merivobox 470N4502S wys.N 450mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 92.95, category: "Szuflady — części" },
  { name: "Boki Merivobox 470N5002S wys.N 500mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 94.05, category: "Szuflady — części" },
  { name: "Boki Merivobox 470M2702S wys.M 270mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 82.75, category: "Szuflady — części" },
  { name: "Boki Merivobox 470M3002S wys.M 300mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 82.75, category: "Szuflady — części" },
  { name: "Boki Merivobox 470M3502S wys.M 350mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 82.75, category: "Szuflady — części" },
  { name: "Boki Merivobox 470M4002S wys.M 400mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 83.69, category: "Szuflady — części" },
  { name: "Boki Merivobox 470M5002S wys.M 500mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 94.05, category: "Szuflady — części" },
  { name: "Boki Merivobox 470M5502S wys.M 550mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 93.37, category: "Szuflady — części" },
  { name: "Boki Merivobox 470M6002S wys.M 600mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 108.84, category: "Szuflady — części" },
  { name: "Boki Merivobox 470K3502S wys.K 350mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 107.69, category: "Szuflady — części" },
  { name: "Boki Merivobox 470K4002S wys.K 400mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 108.68, category: "Szuflady — części" },
  { name: "Boki Merivobox 470K4502S wys.K 450mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 109.62, category: "Szuflady — części" },
  { name: "Boki Merivobox 470K5002S wys.K 500mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 110.61, category: "Szuflady — części" },
  { name: "Boki Merivobox 470K5502S wys.K 550mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 118.30, category: "Szuflady — części" },

  // ---------- Merivobox — prowadnice Blumotion ----------
  { name: "Prowadnica Merivobox Blumotion 450.2700B pełen wysuw 40kg 270mm", unit: "szt", default_price_gross: 86.89, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 450.3001B pełen wysuw 40kg 300mm", unit: "szt", default_price_gross: 86.89, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 450.3501B pełen wysuw 40kg 350mm", unit: "szt", default_price_gross: 86.89, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 450.4001B pełen wysuw 40kg 400mm", unit: "szt", default_price_gross: 88.19, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 450.4501B pełen wysuw 40kg 450mm", unit: "szt", default_price_gross: 89.45, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 450.5001B pełen wysuw 40kg 500mm", unit: "szt", default_price_gross: 90.75, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 450.5501B pełen wysuw 40kg 550mm", unit: "szt", default_price_gross: 98.49, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 450.6001B pełen wysuw 40kg 600mm", unit: "szt", default_price_gross: 117.21, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 453.4501B pełen wysuw 70kg 450mm", unit: "szt", default_price_gross: 116.73, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 453.5001B pełen wysuw 70kg 500mm", unit: "szt", default_price_gross: 118.04, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 453.5501B pełen wysuw 70kg 550mm", unit: "szt", default_price_gross: 126.67, category: "Szuflady — części" },
  { name: "Prowadnica Merivobox Blumotion 453.6001B pełen wysuw 70kg 600mm", unit: "szt", default_price_gross: 149.35, category: "Szuflady — części" },

  // ---------- Merivobox — relingi, boxcap, reling poprzeczny (E, kolor: biały/szary/antracyt) ----------
  { name: "Reling podłużny Merivobox ZR4.300RS.E 300mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 22.69, category: "Szuflady — części" },
  { name: "Reling podłużny Merivobox ZR4.400RS.E 400mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 23.16, category: "Szuflady — części" },
  { name: "Reling podłużny Merivobox ZR4.500RS.E 500mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 24.16, category: "Szuflady — części" },
  { name: "Reling podłużny Merivobox ZR4.600RS.E 600mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 35.71, category: "Szuflady — części" },
  { name: "Boxcap Merivobox ZL4.400S wys.E 400mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 58.76, category: "Szuflady — części" },
  { name: "Boxcap Merivobox ZL4.500S wys.E 500mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 60.33, category: "Szuflady — części" },
  { name: "Boxcap Merivobox ZL4.600S.E wys.E 600mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 71.93, category: "Szuflady — części" },
  { name: "Reling poprzeczny Merivobox ZR4.1059U 1059mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 25.41, category: "Szuflady — części" },

  // ---------- Merivobox — mocowania i fronty szuflady wewnętrznej ----------
  { name: "Mocowanie frontu szufl. wewn. Merivobox ZI4.0MS1 wys.M (biały/szary/antracyt)", unit: "szt", default_price_gross: 47.83, category: "Szuflady — części" },
  { name: "Mocowanie frontu szufl. wewn. Merivobox ZI4.1KS1 wys.K (biały/szary/antracyt)", unit: "szt", default_price_gross: 55.20, category: "Szuflady — części" },
  { name: "Mocowanie frontu szufl. wewn. Merivobox ZI4.2ES1 wys.E (biały/szary/antracyt)", unit: "szt", default_price_gross: 68.38, category: "Szuflady — części" },
  { name: "Front szufl. wewn. z wpustem Merivobox ZV4.1042NN 1042mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 70.79, category: "Szuflady — części" },
  { name: "Front szufl. wewn. bez wpustu Merivobox ZV4.1042M 1042mm (biały/szary/antracyt)", unit: "szt", default_price_gross: 70.00, category: "Szuflady — części" },
  { name: "Uchwyt drewnianej ścianki tylnej Merivobox ZB4N000S wys.N", unit: "szt", default_price_gross: 5.07, category: "Szuflady — części" },
  { name: "Uchwyt drewnianej ścianki tylnej Merivobox ZB4M000S wys.M", unit: "szt", default_price_gross: 4.60, category: "Szuflady — części" },
  { name: "Uchwyt drewnianej ścianki tylnej Merivobox ZB4K000S wys.K", unit: "szt", default_price_gross: 5.60, category: "Szuflady — części" },
  { name: "Uchwyt drewnianej ścianki tylnej Merivobox ZB4E000S wys.E", unit: "szt", default_price_gross: 9.36, category: "Szuflady — części" },

  // ---------- Tip-on (do szuflad i frontów) ----------
  { name: "TIP-ON Blumotion Merivobox L3 T60H4540 15-40kg", unit: "szt", default_price_gross: 71.93, category: "Tip-on" },
  { name: "TIP-ON Blumotion Merivobox L5 T60H4570 35-70kg", unit: "szt", default_price_gross: 71.93, category: "Tip-on" },
  { name: "TIP-ON Blumotion Merivobox S1 T60H4140 10-20kg NL=270-300mm", unit: "szt", default_price_gross: 71.93, category: "Tip-on" },
  { name: "Zestaw synchronizacji TIP-ON Legrabox/Movento Blum T57.7400", unit: "szt", default_price_gross: 29.11, category: "Tip-on" },
  { name: "Odbojnik TIP-ON Blum 956.1004 krótki z magnesem", unit: "szt", default_price_gross: 19.99, category: "Tip-on" },
  { name: "Odbojnik TIP-ON Blum 956A1004 długi z magnesem", unit: "szt", default_price_gross: 25.99, category: "Tip-on" },
  { name: "Odbojnik TIP-ON Blum 956A1006 długi", unit: "szt", default_price_gross: 15.52, category: "Tip-on" },
  { name: "Odbojnik TIP-ON Blum 956A1006F STRONG długi", unit: "szt", default_price_gross: 18.19, category: "Tip-on" },

  // ---------- Siłowniki Aventos HK-XS ----------
  { name: "Siłownik Aventos HK-XS Blum 20K1101T TIP-ON, moc 180-800", unit: "szt", default_price_gross: 42.66, category: "Aventos" },
  { name: "Siłownik Aventos HK-XS Blum 20K1301 moc 500-1500", unit: "szt", default_price_gross: 39.63, category: "Aventos" },
  { name: "Siłownik Aventos HK-XS Blum 20K1301T TIP-ON, moc 500-1200", unit: "szt", default_price_gross: 42.66, category: "Aventos" },
  { name: "Siłownik Aventos HK-XS Blum 20K1501 moc 800-1800", unit: "szt", default_price_gross: 39.63, category: "Aventos" },
  { name: "Siłownik Aventos HK-XS Blum 20K1501T TIP-ON, moc 800-1600", unit: "szt", default_price_gross: 42.66, category: "Aventos" },
  { name: "Mocowanie frontu aluminiowego Aventos HK-XS Blum 20K4101A", unit: "szt", default_price_gross: 12.08, category: "Aventos" },
  { name: "Mocowanie frontu drewnianego Aventos HK-XS Blum 20K4101 (na wkręty)", unit: "szt", default_price_gross: 1.72, category: "Aventos", notes: "Do frontów drewnianych / płyty wiórowej (odpowiednik aluminiowego 20K4101A)." },
  { name: "Mocowanie korpusu Aventos HK-XS Blum 20K5101", unit: "szt", default_price_gross: 2.51, category: "Aventos" },

  // ---------- KOMPLETY Aventos HK-XS (siłownik + mocowania do płyty wiórowej) 2026-06-08 ----------
  // Komplet = siłownik + mocowanie korpusu 20K5101 (2,51) + mocowanie frontu drewn. 20K4101 (1,72) = +4,23.
  // Na 1 stronę korpusu (HK-XS symetryczny). Przy cięższym/szerszym froncie 2 komplety.
  { name: "KOMPLET Aventos HK-XS 20K1101T TIP-ON moc 180-800 + mocowania do płyty wiórowej", unit: "kpl", default_price_gross: 46.89, category: "Aventos", notes: "Siłownik 20K1101T TIP-ON (42,66) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu." },
  { name: "KOMPLET Aventos HK-XS 20K1301 moc 500-1500 + mocowania do płyty wiórowej", unit: "kpl", default_price_gross: 43.86, category: "Aventos", notes: "Siłownik 20K1301 (39,63) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu." },
  { name: "KOMPLET Aventos HK-XS 20K1301T TIP-ON moc 500-1200 + mocowania do płyty wiórowej", unit: "kpl", default_price_gross: 46.89, category: "Aventos", notes: "Siłownik 20K1301T TIP-ON (42,66) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu." },
  { name: "KOMPLET Aventos HK-XS 20K1501 moc 800-1800 + mocowania do płyty wiórowej", unit: "kpl", default_price_gross: 43.86, category: "Aventos", notes: "Siłownik 20K1501 (39,63) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu." },
  { name: "KOMPLET Aventos HK-XS 20K1501T TIP-ON moc 800-1600 + mocowania do płyty wiórowej", unit: "kpl", default_price_gross: 46.89, category: "Aventos", notes: "Siłownik 20K1501T TIP-ON (42,66) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu." },

  // ---------- Nóżki / Multileg ----------
  { name: "Nóżka MULTI LEG czarna H95-145mm 450kg", unit: "szt", default_price_gross: 3.99, category: "Nogi" },
  { name: "Nóżka kuchenna regulowana Würth H-100mm czarna 380kg", unit: "szt", default_price_gross: 5.99, category: "Nogi" },
  { name: "Nóżka kuchenna regulowana Würth H-150mm czarna 500kg", unit: "szt", default_price_gross: 6.99, category: "Nogi" },
  { name: "Nóżka meblowa Volpato czarna H-80mm 400kg", unit: "szt", default_price_gross: 4.92, category: "Nogi" },
  { name: "Klip do nóżki / stopki cokołu Volpato czarny", unit: "szt", default_price_gross: 2.00, category: "Nogi" },
  { name: "Klips do nóżki MULTI LEG czarny 450kg (opak. 2 szt)", unit: "kpl", default_price_gross: 2.00, category: "Nogi", notes: "Zatrzask cokołu do nóżki MULTI LEG. Merkury: opak. 2 szt." },
  { name: "Klucz regulacyjny do nóżek CAMAR SMILE H-80-150mm", unit: "szt", default_price_gross: 19.99, category: "Nogi" },

  // ---------- Zawieszki szafek + listwy montażowe ----------
  { name: "Zawieszka kuchenna CAMAR 806 komplet P+L 100kg", unit: "szt", default_price_gross: 5.98, category: "Zawieszki" },
  { name: "Zawieszka kuchenna CAMAR 807 (lewa/prawa) 240kg/para", unit: "szt", default_price_gross: 13.38, category: "Zawieszki" },
  { name: "Zawieszka kuchenna CAMAR 801 (lewa/prawa) 200kg/para", unit: "szt", default_price_gross: 8.68, category: "Zawieszki" },
  { name: "Zawieszka FORZA komplet P+L 150kg", unit: "szt", default_price_gross: 8.99, category: "Zawieszki" },
  { name: "Zawieszka meblowa uniwersalna długa (biała/popiel/czarna)", unit: "szt", default_price_gross: 2.83, category: "Zawieszki" },
  { name: "Listwa montażowa do zawieszania szafek 1 mb", unit: "szt", default_price_gross: 7.89, category: "Zawieszki" },
  { name: "Listwa montażowa do zawieszania szafek 2 mb", unit: "szt", default_price_gross: 14.15, category: "Zawieszki" },
  { name: "Listwa montażowa do zawieszania szafek 2 mb biała", unit: "szt", default_price_gross: 22.14, category: "Zawieszki" },

  // ============================================================
  // DOSYPKA 2026-06-03 — rozszerzenie wg zapotrzebowania Artura.
  // Ceny brutto PLN, scrap sklep.merkuryam.pl 2026-06-03. Aventos: tylko mechaniczne.
  // ============================================================

  // ---------- Aventos HF — KOMPLETY (ramię 20F3xxx + siłownik 20F2xxx + zaślepki 20F8020) ----------
  // Komplet 2026-06-07 (skład zweryfikowany wg Blum). Na JEDEN front HF potrzeba TRZECH zestawów:
  //   • 1× zestaw ramion 20F3xxx  = 2 ramiona teleskopowe (dobór wg wysokości korpusu),
  //   • 1× zestaw siłowników 20F2xxx = 2 siłowniki + 10 wkrętów, BEZ zaślepek (dobór wg ciężaru frontu, LF=wys×masa),
  //   • 1× zestaw zaślepek 20F8020 (L+P) — OSOBNY, wymagany element (NIE ma go w zestawie siłowników).
  // Cena kompletu = ramię + siłownik + zaślepki. Środkowy (H-560-710): Merkury nie listuje siłownika 20F2500.05,
  // więc cena kompletu jako POŚREDNIA (średnia) między sąsiednimi: (335,92 + 394,24)/2 = 365,08 — decyzja Artura 2026-06-12.
  { name: "KOMPLET Aventos HF H-480-570mm (NA 1 FRONT): ramiona 20F3200 + siłowniki 20F2200.05 + zaślepki 20F8020", unit: "kpl", default_price_gross: 335.92, category: "Aventos", notes: "NA 1 FRONT (oba boki). Ramiona 20F3200 = 2 szt L+P (100,32) + siłowniki 20F2200.05 = 2 szt L+P, moc 2600-5500 dla pary (200,24) + zaślepki 20F8020 L+P (35,36). Siłownik wg ciężaru frontu — przy cięższym dobrać wyższy." },
  { name: "KOMPLET Aventos HF H-560-710mm (NA 1 FRONT): ramiona 20F3500 + siłowniki 20F2500.05 + zaślepki 20F8020", unit: "kpl", default_price_gross: 365.08, category: "Aventos", notes: "NA 1 FRONT (oba boki). Ramiona 20F3500 = 2 szt L+P (110,81) + siłowniki 20F2500.05 = 2 szt L+P, moc 5350-10150 dla pary + zaślepki 20F8020 L+P (35,36). Merkury nie listuje siłownika 20F2500.05, więc cena kompletu = pośrednia (średnia) między H-480-570 (335,92) a H-700-900 (394,24) = 365,08. Decyzja Artura 2026-06-12." },
  { name: "KOMPLET Aventos HF H-700-900mm (NA 1 FRONT): ramiona 20F3800 + siłowniki 20F2800.05 + zaślepki 20F8020", unit: "kpl", default_price_gross: 394.24, category: "Aventos", notes: "NA 1 FRONT (oba boki). Ramiona 20F3800 = 2 szt L+P (131,82) + siłowniki 20F2800.05 = 2 szt L+P, moc 9000-17250 dla pary (227,06) + zaślepki 20F8020 L+P (35,36). Siłownik wg ciężaru frontu — przy lżejszym wystarczy niższy." },
  { name: "Zestaw zaślepek Aventos HF Blum 20F8020 biały (L+P)", unit: "kpl", default_price_gross: 35.36, category: "Aventos", notes: "Wymagane do kompletu HF — NIE ma ich w zestawie siłowników 20F2xxx. 1 zestaw (L+P) na jeden front." },
  { name: "Ogranicznik kąta otwarcia 104° Aventos HF Blum 20F7051", unit: "szt", default_price_gross: 5.06, category: "Aventos" },
  { name: "Adapter Clip do zawiasu Aventos Blum 175H5A00", unit: "szt", default_price_gross: 12.18, category: "Aventos" },

  // ---------- Aventos HL — KOMPLETY (1 komplet = na 1 FRONT, oba boki) ----------
  // Korekta 2026-06-13: poprzednia wersja (podnośniki + zaślepki) była NIEKOMPLETNA — pomijała
  // obowiązkowy zestaw SIŁOWNIKÓW (power store) oraz mocowanie frontu. Skład wg katalogu Blum
  // (potwierdzony w Belmeb / Markat / bivert / ielektronarzedzia / mebloart). Na JEDEN front HL:
  //   • 1× zestaw PODNOŚNIKÓW 20L3xxx  = 2 dźwignie (lewa+prawa), dobór wg WYSOKOŚCI korpusu,
  //   • 1× zestaw SIŁOWNIKÓW  20L2xxx  = 2 siłowniki sprężynowe (power store, L+P), dobór wg WAGI frontu,
  //   • 1× zestaw zaślepek    20L8020  = L+P,
  //   • 1× komplet mocowań frontu 20S4200 = 2 szt (front drewn./płyta; do alu: 20S4200A).
  // UWAGA — siłownik (20L2xxx) jest MECHANICZNY (sprężyna, dobór wg kg) — to NIE jest servo
  //   (servo to osobne, droższe 21Lxxx). Etykieta "SERVO-DRIVE" na Merkury jest myląca (tak samo
  //   podpisane są siłowniki HF 20F2xxx, które też są mechaniczne).
  // DOBÓR SIŁOWNIKA: wg WAGI frontu, nie wysokości. Poniżej w każdym komplecie podano DOMYŚLNY
  //   siłownik dla danej wysokości — przy cięższym froncie podmień na wyższy
  //   (skala udźwigu: 20L2300 < 20L2500 < 20L2700 < 20L2900; ceny w sekcji "elementy" niżej).
  // Ceny brutto Merkury 2026-06-13.
  { name: "KOMPLET Aventos HL H-300-350mm (NA 1 FRONT): podnośniki 20L3200.05 + siłowniki 20L2300.05 + zaślepki 20L8020 + mocowanie 20S4200", unit: "kpl", default_price_gross: 414.77, category: "Aventos", notes: "NA 1 FRONT (oba boki). Podnośniki 20L3200.05 = 2 dźwignie L+P, wg wys. korpusu (147,99). Siłowniki 20L2300.05 = 2 szt power store, dobór wg WAGI frontu ~2–8 kg (219,24). Zaślepki 20L8020 L+P (35,36). Mocowanie frontu 20S4200 = 1 kpl/2 szt (12,18). Cięższy front → wyższy siłownik (20L2500/2700/2900)." },
  { name: "KOMPLET Aventos HL H-350-400mm (NA 1 FRONT): podnośniki 20L3500.05 + siłowniki 20L2500.05 + zaślepki 20L8020 + mocowanie 20S4200", unit: "kpl", default_price_gross: 443.06, category: "Aventos", notes: "NA 1 FRONT (oba boki). Podnośniki 20L3500.05 = 2 dźwignie L+P, wg wys. korpusu (154,30). Siłowniki 20L2500.05 = 2 szt power store, dobór wg WAGI frontu 2–12 kg (241,22). Zaślepki 20L8020 L+P (35,36). Mocowanie frontu 20S4200 = 1 kpl/2 szt (12,18). Lżejszy front → 20L2300, cięższy → 20L2700/2900." },
  { name: "KOMPLET Aventos HL H-400-550mm (NA 1 FRONT): podnośniki 20L3800.05 + siłowniki 20L2500.05 + zaślepki 20L8020 + mocowanie 20S4200", unit: "kpl", default_price_gross: 449.37, category: "Aventos", notes: "NA 1 FRONT (oba boki). Podnośniki 20L3800.05 = 2 dźwignie L+P, wg wys. korpusu (160,61). Siłowniki 20L2500.05 = 2 szt power store, dobór wg WAGI frontu 2–12 kg (241,22). Zaślepki 20L8020 L+P (35,36). Mocowanie frontu 20S4200 = 1 kpl/2 szt (12,18). Cięższy front → 20L2700 (4,25–20 kg) / 20L2900." },
  { name: "KOMPLET Aventos HL H-450-580mm (NA 1 FRONT): podnośniki 20L3900.06 + siłowniki 20L2700.05 + zaślepki 20L8020 + mocowanie 20S4200", unit: "kpl", default_price_gross: 455.44, category: "Aventos", notes: "NA 1 FRONT (oba boki). Podnośniki 20L3900.06 = 2 dźwignie L+P, wg wys. korpusu (177,42). Siłowniki 20L2700.05 = 2 szt power store, dobór wg WAGI frontu 4,25–20 kg (230,48; sprawdź dostępność na Merkury). Zaślepki 20L8020 L+P (35,36). Mocowanie frontu 20S4200 = 1 kpl/2 szt (12,18). Najcięższy front → 20L2900 (381,12)." },

  // ---------- Aventos HL — elementy składowe (do doboru wg wagi / wymiany; każdy zestaw = 2 szt na 1 front) ----------
  { name: "Zestaw siłowników Aventos HL Blum 20L2300.05 (2 szt, power store, front ~2–8 kg, H-300-550)", unit: "kpl", default_price_gross: 219.24, category: "Aventos", notes: "2 siłowniki sprężynowe L+P na 1 front. Dobór wg WAGI frontu. Mechaniczny (nie servo)." },
  { name: "Zestaw siłowników Aventos HL Blum 20L2500.05 (2 szt, power store, front 2–12 kg, H-300-580)", unit: "kpl", default_price_gross: 241.22, category: "Aventos", notes: "2 siłowniki sprężynowe L+P na 1 front. Dobór wg WAGI frontu. Mechaniczny (nie servo)." },
  { name: "Zestaw siłowników Aventos HL Blum 20L2700.05 (2 szt, power store, front 4,25–20 kg, H-300-580)", unit: "kpl", default_price_gross: 230.48, category: "Aventos", notes: "2 siłowniki sprężynowe L+P na 1 front. Dobór wg WAGI frontu. Mechaniczny (nie servo). Sprawdź dostępność na Merkury." },
  { name: "Zestaw siłowników Aventos HL Blum 20L2900.05 (2 szt, power store, najcięższe fronty, H-350-580)", unit: "kpl", default_price_gross: 381.12, category: "Aventos", notes: "2 siłowniki sprężynowe L+P na 1 front. Najwyższy udźwig. Mechaniczny (nie servo)." },
  { name: "Zestaw podnośników Aventos HL Blum 20L3200.05 (2 dźwignie L+P, H-300-350)", unit: "kpl", default_price_gross: 147.99, category: "Aventos", notes: "2 dźwignie L+P na 1 front, dobór wg WYSOKOŚCI korpusu. Wymaga osobnego zestawu siłowników 20L2xxx." },
  { name: "Zestaw podnośników Aventos HL Blum 20L3500.05 (2 dźwignie L+P, H-350-400)", unit: "kpl", default_price_gross: 154.30, category: "Aventos", notes: "2 dźwignie L+P na 1 front, dobór wg WYSOKOŚCI korpusu. Wymaga osobnego zestawu siłowników 20L2xxx." },
  { name: "Zestaw podnośników Aventos HL Blum 20L3800.05 (2 dźwignie L+P, H-400-550)", unit: "kpl", default_price_gross: 160.61, category: "Aventos", notes: "2 dźwignie L+P na 1 front, dobór wg WYSOKOŚCI korpusu. Wymaga osobnego zestawu siłowników 20L2xxx." },
  { name: "Zestaw podnośników Aventos HL Blum 20L3900.06 (2 dźwignie L+P, H-450-580)", unit: "kpl", default_price_gross: 177.42, category: "Aventos", notes: "2 dźwignie L+P na 1 front, dobór wg WYSOKOŚCI korpusu. Wymaga osobnego zestawu siłowników 20L2xxx." },
  { name: "Zestaw zaślepek Aventos HL Blum 20L8020 (L+P, zapas/wymiana)", unit: "kpl", default_price_gross: 35.36, category: "Aventos", notes: "1 zestaw (L+P) na 1 front. W komplecie HL już wliczony — tu jako zapas/wymiana." },
  { name: "Łącznik stabilizacji poprzecznej Aventos HL Blum 20Q153ZA", unit: "szt", default_price_gross: 46.37, category: "Aventos", notes: "Dodatek do szerokich frontów (stabilizacja przed przekoszeniem). Nie wliczony w komplet." },
  { name: "Stabilizacja poprzeczna Aventos Blum 22Q1076U 1076mm", unit: "szt", default_price_gross: 45.28, category: "Aventos", notes: "Reling stabilizacji do szerokich frontów. Nie wliczony w komplet." },

  // ---------- Aventos HK top (siłowniki z TIP-ON) ----------
  // Każdy "zestaw siłowników" = 2 siłowniki (L+P) na 1 front. Podana "moc" (współczynnik mocy)
  // dotyczy PARY siłowników (przy 2 szt) — nie pojedynczej sztuki. Zaślepki 22K8000 dochodzą osobno.
  { name: "Zestaw siłowników Aventos HK top z TIP-ON Blum 22K2300T moc 420-1610 (2 szt L+P, na 1 front)", unit: "kpl", default_price_gross: 212.24, category: "Aventos", notes: "Zestaw = 2 siłowniki L+P na 1 front. Moc 420-1610 dla pary. Zaślepki 22K8000 osobno." },
  { name: "Zestaw siłowników Aventos HK top z TIP-ON Blum 22K2500T moc 930-2800 (2 szt L+P, na 1 front)", unit: "kpl", default_price_gross: 212.24, category: "Aventos", notes: "Zestaw = 2 siłowniki L+P na 1 front. Moc 930-2800 dla pary. Zaślepki 22K8000 osobno." },
  { name: "Zestaw siłowników Aventos HK top z TIP-ON Blum 22K2900T moc 3200-9000 (2 szt L+P, na 1 front)", unit: "kpl", default_price_gross: 259.54, category: "Aventos", notes: "Zestaw = 2 siłowniki L+P na 1 front. Moc 3200-9000 dla pary. Zaślepki 22K8000 osobno." },
  { name: "Zestaw siłowników Aventos HK z TIP-ON Blum 20K2300T moc 480-1500 (2 szt L+P, na 1 front)", unit: "kpl", default_price_gross: 180.42, category: "Aventos", notes: "Zestaw = 2 siłowniki L+P na 1 front. Moc 480-1500 dla pary." },
  { name: "Zestaw zaślepek Aventos HK top Blum 22K8000 biały (L+P, na 1 front)", unit: "kpl", default_price_gross: 31.16, category: "Aventos", notes: "1 zestaw (L+P) na 1 front." },

  // ---------- Aventos HK-S (siłowniki pojedyncze + komplet) ----------
  // UWAGA: pozycje "Siłownik ... szt" to POJEDYNCZA sztuka — na 1 front standardowo 2 szt (L+P).
  // Pozycja 20K2B00.06 to gotowy KOMPLET = 2 siłowniki (L+P) + zaślepki — na 1 front.
  { name: "Siłownik Aventos HK-S z Blumotion Blum 20K2C01.02 moc 400-1000 (1 szt — na front 2 szt)", unit: "szt", default_price_gross: 41.24, category: "Aventos", notes: "Pojedynczy siłownik. Na 1 front standardowo 2 szt (L+P). Moc 400-1000 dla pary." },
  { name: "Siłownik Aventos HK-S z TIP-ON Blum 20K2C01T moc 400-1000 (1 szt — na front 2 szt)", unit: "szt", default_price_gross: 42.14, category: "Aventos", notes: "Pojedynczy siłownik. Na 1 front standardowo 2 szt (L+P). Moc 400-1000 dla pary." },
  { name: "Siłownik Aventos HK-S z Blumotion Blum 20K2E01.02 moc 960-2215 (1 szt — na front 2 szt)", unit: "szt", default_price_gross: 41.24, category: "Aventos", notes: "Pojedynczy siłownik. Na 1 front standardowo 2 szt (L+P). Moc 960-2215 dla pary." },
  { name: "Siłownik Aventos HK-S z TIP-ON Blum 20K2E01T moc 960-2215 (1 szt — na front 2 szt)", unit: "szt", default_price_gross: 42.14, category: "Aventos", notes: "Pojedynczy siłownik. Na 1 front standardowo 2 szt (L+P). Moc 960-2215 dla pary." },
  { name: "KOMPLET Aventos HK-S Blumotion 20K2B00.06 moc 220-500: 2 siłowniki L+P + zaślepki (na 1 front)", unit: "kpl", default_price_gross: 108.01, category: "Aventos", notes: "KOMPLET na 1 front: 2 siłowniki (L+P) + zaślepki. Moc 220-500 dla pary. Do małych frontów uchylnych." },
  { name: "Ogranicznik kąta 100° Aventos HK-S Blum 20K7A41", unit: "szt", default_price_gross: 2.14, category: "Aventos" },
  { name: "Ogranicznik kąta 75° Aventos HK-S Blum 20K7A11", unit: "szt", default_price_gross: 2.14, category: "Aventos" },
  { name: "Mocowanie frontu aluminiowego Aventos HK-S Blum 20K4A00A02", unit: "szt", default_price_gross: 26.67, category: "Aventos" },
  { name: "Mocowanie frontu drewnianego Aventos HS/HK/HL Blum 20S4200 (komplet 2 szt, na 1 front)", unit: "kpl", default_price_gross: 12.18, category: "Aventos", notes: "Merkury sprzedaje jako komplet = 2 szt (L+P) — 1 komplet na 1 front. W komplecie HL już wliczony." },
  { name: "Mocowanie frontu aluminiowego Aventos HS/HK/HL Blum 20S4200A (do frontów alu)", unit: "kpl", default_price_gross: 53.27, category: "Aventos", notes: "Odpowiednik alu do 20S4200. Sprawdź na Merkury, czy cena za komplet (2 szt) czy za szt." },

  // ---------- Nóżki MULTI LEG — wszystkie wysokości (czarny, 450kg) ----------
  { name: "Nóżka MULTI LEG czarna H 50-75mm 450kg", unit: "szt", default_price_gross: 3.59, category: "Nogi" },
  { name: "Nóżka MULTI LEG czarna H 65-85mm 450kg", unit: "szt", default_price_gross: 3.59, category: "Nogi" },
  { name: "Nóżka MULTI LEG czarna H 85-125mm 450kg", unit: "szt", default_price_gross: 3.59, category: "Nogi" },
  { name: "Nóżka MULTI LEG czarna H 125-195mm 450kg", unit: "szt", default_price_gross: 3.99, category: "Nogi" },

  // ---------- Nóżki CAMAR SMILE (stopka bez główki, 300kg) ----------
  { name: "Stopka CAMAR SMILE czarna H-80mm bez główki 300kg", unit: "szt", default_price_gross: 2.76, category: "Nogi" },
  { name: "Stopka CAMAR SMILE czarna H-100mm bez główki 300kg", unit: "szt", default_price_gross: 2.86, category: "Nogi" },
  { name: "Stopka CAMAR SMILE czarna H-150mm bez główki 300kg", unit: "szt", default_price_gross: 3.96, category: "Nogi" },

  // ---------- TIP-ON długie — warianty kolorystyczne ----------
  { name: "Odbojnik TIP-ON Blum 956A1006 długi, biały", unit: "szt", default_price_gross: 15.52, category: "Tip-on" },
  { name: "Odbojnik TIP-ON Blum 956A1006 długi, szary", unit: "szt", default_price_gross: 15.52, category: "Tip-on" },
  { name: "Odbojnik TIP-ON Blum 956A1006F STRONG długi, biały", unit: "szt", default_price_gross: 18.19, category: "Tip-on" },
  { name: "Odbojnik TIP-ON Blum 956A1004 długi z magnesem, biały", unit: "szt", default_price_gross: 19.77, category: "Tip-on" },
  { name: "Odbojnik TIP-ON Blum 956A1004 długi z magnesem, czarny carbon", unit: "szt", default_price_gross: 19.77, category: "Tip-on" },

  // ---------- Łączenia blatu ----------
  { name: "Złącze do blatów QUICK M8 x 65mm szare", unit: "szt", default_price_gross: 7.77, category: "Łączenie blatów" },
  { name: "Złącze do blatów QUICK M8 x 100mm szare", unit: "szt", default_price_gross: 8.62, category: "Łączenie blatów" },
  { name: "Złącze do blatów QUICK M8 x 150mm szare", unit: "szt", default_price_gross: 8.73, category: "Łączenie blatów" },
  { name: "KOMPLET złączy QUICK M8 x 100mm (3 szt — na jedno łączenie blatu)", unit: "kpl", default_price_gross: 25.86, category: "Łączenie blatów", notes: "3× QUICK M8 100mm (8,62 zł/szt). Typowo 3 złącza na jedno łączenie blatu." },
  { name: "Klej do blatów ColorJoint 20g (na jedno łączenie, dobór koloru)", unit: "szt", default_price_gross: 21.59, category: "Łączenie blatów", notes: "Kolory: biały/antracyt/szary/dębowy/kamienny/kremowy/łupkowy/brązowy/czarny. 1 tuba ≈ 1 łączenie." },

  // ---------- Ogranicznik kąta otwarcia zawiasu ----------
  { name: "Ogranicznik kąta otwarcia zawiasu do 110° Blum 70T7553", unit: "szt", default_price_gross: 1.83, category: "Zawiasy", notes: "Clip, do zawiasu kątowego 155°; ogranicza otwarcie do 110°." },

  // ---------- Wkłady do szuflad ----------
  { name: "Wkład na sztućce Orga-Line Blum ZSI.500BI1N L-500mm", unit: "szt", default_price_gross: 149.20, category: "Wkłady szuflad", notes: "Do szer. korpusu od 103mm. Orga-Line (Tandembox); do Merivobox dobrać odpowiednik Ambia-Line." },

  // ---------- ZESTAWY Merivobox (gotowy komplet Merkury: boki+prowadnica Blumotion+uchwyt ścianki+mocowania+zaślepki) ----------
  // Cena = gotowy zestaw Merkury (rabat bundle). Dno i ścianka tylna — Zimex. Kolor nie zmienia ceny.
  // 70kg = 40kg + różnica prowadnicy 453 vs 450 (+27,3 zł). Każda konfiguracja w 40kg i 70kg.
  // --- 40 kg ---
  { name: "Zestaw szuflady Merivobox 450mm niska M 40kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 165.25, category: "Szuflady", notes: "Boki M + prowadnica 40kg + uchwyt ścianki tylnej + mocowania frontu + zaślepki. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 500mm niska M 40kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 167.51, category: "Szuflady", notes: "Boki M + prowadnica 40kg + uchwyt ścianki tylnej + mocowania frontu + zaślepki. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 450mm niska K 40kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 207.27, category: "Szuflady", notes: "Pełny zestaw wys. K, prowadnica 40kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 500mm niska K 40kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 209.56, category: "Szuflady", notes: "Pełny zestaw wys. K, prowadnica 40kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 450mm wysoka z relingiem E 40kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 207.91, category: "Szuflady", notes: "Pełny zestaw E z relingiem, prowadnica 40kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 500mm wysoka z relingiem E 40kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 210.65, category: "Szuflady", notes: "Pełny zestaw E z relingiem, prowadnica 40kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 450mm wysoka z boxcap E 40kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 232.47, category: "Szuflady", notes: "Pełny zestaw E z boxcap, prowadnica 40kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 500mm wysoka z boxcap E 40kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 235.52, category: "Szuflady", notes: "Pełny zestaw E z boxcap, prowadnica 40kg. Dno/ścianka tylna w Zimexie." },
  // --- 70 kg ---
  { name: "Zestaw szuflady Merivobox 450mm niska M 70kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 192.53, category: "Szuflady", notes: "Boki M + prowadnica 70kg + uchwyt ścianki tylnej + mocowania frontu + zaślepki. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 500mm niska M 70kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 194.80, category: "Szuflady", notes: "Boki M + prowadnica 70kg + uchwyt ścianki tylnej + mocowania frontu + zaślepki. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 450mm niska K 70kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 234.55, category: "Szuflady", notes: "Pełny zestaw wys. K, prowadnica 70kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 500mm niska K 70kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 236.85, category: "Szuflady", notes: "Pełny zestaw wys. K, prowadnica 70kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 450mm wysoka z relingiem E 70kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 235.19, category: "Szuflady", notes: "Pełny zestaw E z relingiem, prowadnica 70kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 500mm wysoka z relingiem E 70kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 237.94, category: "Szuflady", notes: "Pełny zestaw E z relingiem, prowadnica 70kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 450mm wysoka z boxcap E 70kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 259.75, category: "Szuflady", notes: "Pełny zestaw E z boxcap, prowadnica 70kg. Dno/ścianka tylna w Zimexie." },
  { name: "Zestaw szuflady Merivobox 500mm wysoka z boxcap E 70kg (biały/szary/antracyt)", unit: "kpl", default_price_gross: 262.81, category: "Szuflady", notes: "Pełny zestaw E z boxcap, prowadnica 70kg. Dno/ścianka tylna w Zimexie." },

  // ---------- Prowadnice Movento do szuflady skrzynkowej (drewniane boki, komplet=para) ----------
  // (Movento 320mm 760H3200S — na zamówienie, cena NULL — wstawiany przez migrację, nie tu, by nie pokazywać 0 zł.)
  { name: "Prowadnica Movento z Blumotion Blum 760H3000S 300mm 40kg (komplet, do skrzynkowej)", unit: "kpl", default_price_gross: 113.65, category: "Szuflady — części", notes: "Pełny wysuw, drewniane boki. Wymaga sprzęgła T51.7601 (L+P)." },
  { name: "Prowadnica Movento z Blumotion Blum 760H5000SU 500mm 40kg (komplet, do skrzynkowej)", unit: "kpl", default_price_gross: 149.92, category: "Szuflady — części", notes: "Pełny wysuw, drewniane boki. Wymaga sprzęgła T51.7601 (L+P)." },
  { name: "Sprzęgło Movento z regulacją boczną Blum T51.7601 (szt — 2 na szufladę)", unit: "szt", default_price_gross: 6.43, category: "Szuflady — części", notes: "Lewe/prawe po 6,43 zł. Do prowadnic Movento — 2 szt na jedną szufladę skrzynkową." },

  // ---------- Zawieszki Blum do szafek (biała, 130kg/para) ----------
  { name: "Zawieszka do szafek Blum 48N0510.02 prawa, biała (130kg/para)", unit: "szt", default_price_gross: 5.18, category: "Zawieszki" },
  { name: "Zawieszka do szafek Blum 48N0510.03 lewa, biała (130kg/para)", unit: "szt", default_price_gross: 5.18, category: "Zawieszki" },

  // ---------- TIP-ON do drzwi/frontów — adaptery (do jednostki odbojnika TIP-ON) ----------
  { name: "Adapter prosty wpuszczany do TIP-ON Blum 956A1201 długi (biały/szary)", unit: "szt", default_price_gross: 3.51, category: "Tip-on", notes: "Montaż wpuszczany w bok korpusu. Łączy się z odbojnikiem TIP-ON 956A1004/1006 — otwieranie frontów/drzwiczek bez uchwytu." },
  { name: "Adapter krzyżakowy do TIP-ON Blum 956A1501 długi, szary", unit: "szt", default_price_gross: 2.51, category: "Tip-on", notes: "Mocowany na prowadniku zawiasu — TIP-ON do drzwiczek z zawiasami. Łączy się z odbojnikiem TIP-ON." },
  { name: "Zawias nakładany Blum 71T6550 Clip-T 170° ze sprężyną (kąt szeroki)", unit: "szt", default_price_gross: 14.27, category: "Zawiasy" },

  // ---------- Zawiasy Blum — 155° Blumotion, równoległy Blumotion, warianty onyks (2026-06-08) ----------
  // Ceny brutto, sklep.merkuryam.pl. Onyks ≠ cena nikla (sprawdzane per produkt).
  { name: "Zawias Blum 71B7550 BLUMOTION Clip-T 155° nakładany (zerowy uskok)", unit: "szt", default_price_gross: 25.14, category: "Zawiasy", notes: "Wbudowany Blumotion (cichy domyk). Najszerszy kąt z fabrycznym Blumotion (Blum nie ma 170° z wbud. Blumotion)." },
  { name: "Zawias Blum 71B7550 BLUMOTION Clip-T 155° nakładany, onyks", unit: "szt", default_price_gross: 29.59, category: "Zawiasy", notes: "Wersja onyks (czarna). Wbudowany Blumotion 155°. Nikiel: 25,14." },
  { name: "Zawias Blum 71B3550 BLUMOTION Clip-T 110° nakładany, onyks", unit: "szt", default_price_gross: 13.70, category: "Zawiasy", notes: "Wersja onyks głównego zawiasu 110° z Blumotion. Nikiel: 12,29." },
  { name: "Zawias równoległy wpuszczany Blum 79B9550 BLUMOTION Clip-T 95°, onyks", unit: "szt", default_price_gross: 19.19, category: "Zawiasy", notes: "Równoległy z wbudowanym Blumotion — odpowiednik 79T9550, ale z cichym domykiem. Onyks." },
  { name: "Zawias równoległy wpuszczany Blum 79B9550 BLUMOTION Clip-T 95° (nikiel)", unit: "szt", default_price_gross: 17.82, category: "Zawiasy", notes: "Równoległy z wbudowanym Blumotion (cichy domyk). Wersja nikiel; onyks osobno: 19,19." },
  { name: "Zawias równoległy Blum 78T9550.83 Clip-T 83° bez sprężyny", unit: "szt", default_price_gross: 11.08, category: "Zawiasy", notes: "Równoległy 83° BEZ sprężyny — do TIP-ON lub mechanizmów bez automatu domykania." },
  { name: "Zawias równoległy nakładany Blum 79T9950.37 Clip-T 95° ze sprężyną", unit: "szt", default_price_gross: 20.49, category: "Zawiasy", notes: "Równoległy NAKŁADANY 95° ze sprężyną (nie wpuszczany jak 79T9550/79B9550)." },

  // ---------- KOMPLETY zawias + prowadnik ----------
  { name: "KOMPLET zawias Blum 71B3550 Blumotion 110° + prowadnik 173H7100", unit: "kpl", default_price_gross: 14.43, category: "Zawiasy komplety", notes: "Zawias z amortyzacją (12,29) + prowadnik krzyżakowy mimośrodowy (2,14)." },
  { name: "KOMPLET zawias Blum 71T3550 Clip-T 110° + prowadnik 173L8100", unit: "kpl", default_price_gross: 7.47, category: "Zawiasy komplety", notes: "Zawias bez amortyzacji (6,17) + prowadnik krzyżakowy z regulacją (1,30)." },
  { name: "KOMPLET zawias Blum 71T6550 Clip-T 170° + klipsowy Blumotion 973A6000 (cichy domyk)", unit: "kpl", default_price_gross: 24.77, category: "Zawiasy komplety", notes: "Zawias 170° ze sprężyną (14,27) + amortyzator klipsowy Blumotion 973A6000 (10,50). Pełne 170° z cichym domykiem — Blum nie ma 170° z wbud. Blumotion." },
];
