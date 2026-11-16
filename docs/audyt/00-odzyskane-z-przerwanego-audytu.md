# Audyt LUVIANO — wyniki odzyskane z przerwanej sesji (2026-11-12)

Źródło: lokalne zapisy subagentów w `.claude/projects/C--Cloude/cd7b18b6-.../subagents/`.
Wszyscy trzej agenci zatrzymali się na braku kredytów Fable. **Żaden nie napisał raportu**
(katalog `docs/audyt` nie istniał, brak makiet) — wykonali tylko zbieranie danych.
Poniżej wyłącznie fakty zmierzone w ich poleceniach; to NIE jest analiza ani wnioski końcowe.

## Stan faktyczny audytu

| Agent | Zakres | Co zrobił | Raport |
|---|---|---|---|
| 1 Architekt/LiDAR | sync, geometria, RLS, CI | 24 polecenia Bash + 3 odczyty; tylko inwentarz plików (wc, ls, package.json) | brak |
| 2 UX/UI | ekrany WWW + skaner | najdalej: 25 odczytów, 3 grepy; analiza kodu kalkulatora/cennika, kontrasty, rozmiary czcionek, 5 zrzutów (magic plan) | brak, brak makiet |
| 3 Produkt/finanse | wzory, proces, parytet cen | przeczytał profitability, jobMargin, tax, zus, taxDeadlines, timerRate, format, units, test-calc, cabinetPricing, WardrobePricing.swift; uruchomił test:calc | brak |

## Zmierzone fakty (do wykorzystania)

**Testy**: `npm run test:calc` → 12/12 przechodzi (rachunek rentowności, rabat, kwota wolna/próg skali,
zdrowotna minimalna, zlecenie bez faktury, rezerwa urlop/L4, plan vs wykonanie). Brak testów: ZUS-fazy,
timerRate, cabinetPricing, parytet z WardrobePricing.swift, geometria skanera.
`tsc`/`lint` — nie uruchomione.

**Repo**: `main` = origin/main; niezatwierdzone tylko `public/tla2.html`, `tla3.html`, `scripts/pro100/*`.

**Kalkulator/cennik — ściśnięte kolumny (częściowa diagnoza agenta 2)**:
- Wcześniejsze poprawki cennika szafek: `2cc2b29` (w-full w wspólnej klasie INPUT wygrywało z w-24 → `shrink-0` per pole)
  i `760b38f` (układ 1-kolumnowy do `2xl:`, `basis-64`). Wzorzec mógł przetrwać gdzie indziej.
- Kandydaci do sprawdzenia (siatki sztywne `grid-cols-3/4` bez wariantu responsywnego, w kolumnie obok sidebara):
  `invoices/InvoiceEditForm.tsx:39`, `invoices/CostLineCard.tsx:160`, `materials/AddCatalogForm.tsx:20`,
  `finanse/page.tsx:138`, `finanse/rentownosc/page.tsx:51,128`, `finanse/ksiegowosc/page.tsx:124`,
  `jobs/[id]/page.tsx:573`, `jobs/[id]/TimeTracker.tsx:472`, `jobs/[id]/RoomScanSection.tsx:68`,
  `jobs/[id]/LaborForm.tsx:67` (`1fr_1.3fr`), `jobs/[id]/PlanSection.tsx:63`.
  Przyczyna dla samego kalkulatora (`CalculatorForm.tsx`, `moduly/ModuleCalculator.tsx`, `wycena/GroupMaterialsPicker.tsx`)
  — NIEZWERYFIKOWANA, agent jej nie zdążył opisać.
- Tabele bez `min-w`: `cennik-szafek/CabinetRatesForm.tsx:211` (`w-full`, bez overflow-x-auto);
  `RoomScanSection.tsx` ma overflow-x-auto (4 tabele).

**Czytelność (web)**: 290 użyć `text-[9|10|10.5|11px]` (najwięcej: CalculatorForm 28, jobs/[id]/page 16,
ScanEstimate 14, finanse/terminy 12). Kontrast WCAG policzony:
- `#1f1d1b` na `#f2f2f1` 15.0 ✔; `#6f6c66` na białym 5.23 ✔, na tle strony 4.67 ✔
- `#8d8a85` (najczęstszy szary, 100+ użyć) na białym **3.44**, na tle **3.07** ✘ (<4.5)
- `#a06f3f` (złoty akcent) jako tekst na białym **4.34**, na tle **3.87** ✘ drobny tekst; biały na złotym 4.34 ✘
- `#7d5530` (ciemny złoty) 6.53 ✔ — kandydat na tekst; `#a18653` 3.47 ✘; `#4f8a64` 4.08 ✘; `#b3b0aa/#c9c7c2` dekoracyjne <2.6
- Wniosek wstępny: drobny tekst w `#8d8a85` i złocie `#a06f3f` w terenie (jasne światło) jest za słaby.

**Czytelność (skaner, z kodu)**: stałe `.font(.system(size:))`: 6–11 pt użyte ~44 razy
(najwięcej `ScanPDF.swift` 31 — to PDF, mniej istotne; `PlanCanvas` 9, `ElevationCanvas` 5);
semantyczne fonty (`caption` 60, `subheadline` 30) — Dynamic Type częściowo. Kolory skanera: mieszanka
Color.green/orange/stałych RGB, tylko część z palety (#a06f3f, #282624, #faf8f3).

**Rozmiary kodu skanera** (wg agenta 3, nowsze niż wcześniejszy wc): `ScanResultView.swift` 1370 linii (hub — kandydat do podziału),
`Scan3DView` 834, `PlanCanvas` 726, `PlanGeom` 577, `Wardrobe` 530, `WardrobeEditor` 467.

**Nie ustalone (agenci nie dotarli)**: przepływ danych skaner↔WWW, RLS/bezpieczeństwo, endpointy cron, dostęp offline/konflikty,
pochodzenie wymiaru (LiDAR vs laser vs ręczny), poprawność wzorów VAT/ZUS/marża-vs-narzut, parytet cen szaf iPad↔WWW,
mapa procesu, makiety, plan testów.

## Kalkulator — przegląd kodu (2026-11-13)

Przeczytane: `calculator/page.tsx`, `CalculatorForm.tsx` (siatki, pola, BOM, styled-jsx `.input`), `moduly/ModuleCalculator.tsx` (grep),
`jobs/[id]/wycena/GroupMaterialsPicker.tsx` (wiersze), `QtyCalculator.tsx`, `materials/MaterialsBrowser.tsx`, `ui/PageContainer.tsx`,
`layout.tsx` (powłoka), `Sidebar.tsx` (szerokości), `globals.css`.

- Powłoka OK: sidebar 240 px (68 px zwinięty) od `md`; kolumna treści `min-w-0`; na iPadzie 13" w pionie (1032 pt) zostaje ok. 690 px treści.
- Kalkulator używa `PageContainer width="narrow"` = max 640 px — formularz nie jest ściśnięty, ale na iPadzie (zwł. poziomo, 1376 pt) zostaje dużo pustego miejsca;
  wynik/podsumowanie mogłoby stać obok formularza (≥ `xl`) — to propozycja ergonomiczna P2, nie błąd.
- Wiersze kalkulatora, BOM, wyceny i katalogu materiałów mają poprawne `min-w-0` / `shrink-0` / `break-words` — nie znalazłem w nich przyczyny ściskania.
- Znana przyczyna ściskania (cennik szafek: `w-full` we wspólnej klasie wygrywało z `w-24`; siatka 2-kolumnowa od `lg`) została naprawiona
  w `2cc2b29` i `760b38f` (2026-11-11, 22:10) — zrzuty z prośby Artura prawdopodobnie sprzed tej poprawki. NIEZWERYFIKOWANE bez nowego zrzutu.
- `.input` w kalkulatorach to lokalne `styled-jsx` (nie globalna klasa) — zduplikowane w `CalculatorForm`, `ModuleCalculator`, `ServiceCalculatorForm` (spójność: P2).
- Nadal drobne (P2): 28 użyć `text-[10–11px]` w `CalculatorForm.tsx`; szare `#8d8a85`/`zinc-500` poniżej kontrastu 4,5.
