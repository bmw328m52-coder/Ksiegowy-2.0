// Testy rachunku rentowności (src/lib/profitability.ts) — bez dodatkowych bibliotek.
// Uruchom: npm run test:calc
// Pliki .ts są przepisywane na JS kompilatorem TypeScript (devDependency) do katalogu tymczasowego.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const libDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "luviano-calc-"));
fs.writeFileSync(path.join(outDir, "package.json"), '{"type":"commonjs"}');
for (const name of ["tax", "zus", "profitability", "format"]) {
  const src = fs.readFileSync(path.join(libDir, `${name}.ts`), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.writeFileSync(path.join(outDir, `${name}.js`), js);
}
const { parseAmount } = require(path.join(outDir, "format.js"));
const { calcJobProfit, requiredPriceGross, rateStatus, requiredHourlyRate, planVsActual } = require(
  path.join(outDir, "profitability.js"),
);
process.on("exit", () => fs.rmSync(outDir, { recursive: true, force: true }));

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

// Scenariusz Artura: sprzedaż 35 500 netto + VAT 8%, materiały realnie 23 000 brutto
// (plan 20 000), 225 h, ulga na start (społeczne 0), cel 23 000 zł na rękę.
const base = {
  amountGross: 35500 * 1.08,
  vatRate: 0.08,
  isVatPayer: true,
  withInvoice: true,
  deductCostsVat: false,
  costsGross: 23000,
  costsVatRate: 0.23,
  taxForm: "skala",
  yearIncomeBefore: 0,
  pitFlat: true,
  hours: 225,
  billableHoursMonth: 120,
  socialMonthly: 0,
  healthMinMonthly: 432.54,
  rentMonthly: 300,
  reserveRatio: 0,
};

test("scenariusz 35 500 netto / 23 000 materiały / 225 h — rachunek krok po kroku", () => {
  const r = calcJobProfit(base);
  near(r.revenueNet, 35500);
  near(r.revenueVat, 2840);
  near(r.costsNet, 23000 / 1.23);
  const income = 35500 - 23000 / 1.23; // 16 800,81
  near(r.incomeBeforeTax, income);
  near(r.vatToPay, 0); // VAT z materiałów (23%) większy niż należny (8%)
  near(r.pit, income * 0.12);
  near(r.health, income * 0.09); // 9% dochodu > minimalna za 225 h
  near(r.rent, (300 / 120) * 225);
  near(r.netCash, income * (1 - 0.12 - 0.09) - 562.5);
  near(r.ratePerHour, r.netCash / 225);
  assert.ok(r.ratePerHour > 55 && r.ratePerHour < 60, `stawka ${r.ratePerHour}`);
});

test("cena wymagana dla celu 23 000 zł na rękę odtwarza cel", () => {
  const { amountGross: _a, ...rest } = base;
  const price = requiredPriceGross(rest, 23000);
  near(calcJobProfit({ ...base, amountGross: price }).netCash, 23000, 0.05);
  assert.ok(price > base.amountGross);
  // Kontrola ręczna: dochód = (23000 + 562,5) / 0,79; netto = dochód + koszty netto
  near(price, ((23000 + 562.5) / 0.79 + 23000 / 1.23) * 1.08, 0.5);
});

test("materiały 20 000 → 23 000: strata na rękę mniejsza niż 3 000 (VAT i podatki)", () => {
  const planned = calcJobProfit({ ...base, costsGross: 20000 });
  const actual = calcJobProfit(base);
  const lost = planned.netCash - actual.netCash;
  near(lost, (3000 / 1.23) * 0.79);
});

test("rabat liczony przez podatki, nie prostym odejmowaniem", () => {
  const before = calcJobProfit(base);
  const after = calcJobProfit({ ...base, amountGross: base.amountGross - 2000 });
  near(before.netCash - after.netCash, (2000 / 1.08) * 0.79);
  assert.ok(before.netCash - after.netCash < 2000);
});

test("kwota wolna i próg skali", () => {
  const free = calcJobProfit({ ...base, pitFlat: false });
  near(free.pit, 0); // 16 800 dochodu mieści się w 30 000 wolnych
  const high = calcJobProfit({ ...base, pitFlat: false, yearIncomeBefore: 120000 });
  near(high.pit, high.incomeBeforeTax * 0.32);
});

test("zdrowotna nie spada poniżej minimalnej; społeczne obniżają podstawę PIT", () => {
  const low = calcJobProfit({ ...base, amountGross: 26000 });
  near(low.health, (432.54 / 120) * 225);
  const full = calcJobProfit({ ...base, socialMonthly: 1926.76 });
  near(full.social, (1926.76 / 120) * 225);
  near(full.pit, (full.incomeBeforeTax - full.social) * 0.12);
});

test("bez faktury: brak VAT i PIT, zdrowotna minimalna", () => {
  const r = calcJobProfit({ ...base, withInvoice: false, amountGross: 38000 });
  near(r.pit, 0);
  near(r.vatToPay, 0);
  near(r.incomeBeforeTax, 15000);
  near(r.netCash, 15000 - (432.54 / 120) * 225 - 562.5);
  const rec = calcJobProfit({ ...base, withInvoice: false, amountGross: 38000, deductCostsVat: true });
  near(rec.recoveredVat, 23000 - 23000 / 1.23);
});

test("rezerwa urlop/L4 odejmowana raz, od kwoty po kosztach stałych", () => {
  const r = calcJobProfit({ ...base, reserveRatio: 208 / 1728 });
  near(r.reserve, r.cashAfterFixed * (208 / 1728));
  near(r.netCash, r.cashAfterFixed - r.reserve);
});

test("cel miesięczny i progi kolorów", () => {
  near(requiredHourlyRate(12000, 120), 100);
  assert.equal(rateStatus(100, 100, 75), "cel");
  assert.equal(rateStatus(80, 100, 75), "minimum");
  assert.equal(rateStatus(60, 100, 75), "ponizej");
});

// Plan zapisany na zleceniu: 20 000 materiałów i 180 h, cel 100 zł/h, minimum 75.
const plan = { input: { ...base, costsGross: 20000, hours: 180 }, targetRate: 100, minRate: 75 };

test("plan a wykonanie: po zakończeniu liczą się faktyczne godziny i faktury", () => {
  const r = planVsActual(plan, { amountGross: base.amountGross, hours: 225, costsGross: 23000, finished: true });
  near(r.planned.netCash, calcJobProfit(plan.input).netCash);
  near(r.actual.netCash, calcJobProfit(base).netCash);
  assert.equal(r.hoursFromPlan, false);
  assert.equal(r.costsFromPlan, false);
  assert.ok(r.actual.ratePerHour < r.planned.ratePerHour);
  assert.equal(r.actualStatus, "ponizej");
  near(calcJobProfit({ ...base, amountGross: r.priceForTarget }).ratePerHour, 100, 0.01);
});

test("plan a wykonanie: w toku prognoza nie spada poniżej planu godzin i kosztów", () => {
  const early = planVsActual(plan, { amountGross: base.amountGross, hours: 40, costsGross: 5000, finished: false });
  assert.equal(early.hoursUsed, 180);
  assert.equal(early.costsUsed, 20000);
  assert.equal(early.hoursFromPlan, true);
  near(early.actual.ratePerHour, early.planned.ratePerHour);
  const over = planVsActual(plan, { amountGross: base.amountGross, hours: 200, costsGross: 21000, finished: false });
  assert.equal(over.hoursUsed, 200);
  assert.equal(over.costsUsed, 21000);
  assert.ok(over.actual.ratePerHour < over.planned.ratePerHour);
});

test("plan a wykonanie: brak godzin i faktur po zakończeniu → wartości z planu; rabat zmienia wynik", () => {
  const r = planVsActual(plan, { amountGross: 0, hours: 0, costsGross: 0, finished: true });
  assert.equal(r.hoursFromPlan, true);
  assert.equal(r.costsFromPlan, true);
  near(r.actual.netCash, r.planned.netCash);
  const cheaper = planVsActual(plan, { amountGross: base.amountGross - 2000, hours: 0, costsGross: 0, finished: true });
  near(r.planned.netCash - cheaper.actual.netCash, (2000 / 1.08) * 0.79);
});

test("parseAmount: dotychczasowe poprawne zapisy bez zmian", () => {
  assert.equal(parseAmount("12300"), 12300);
  assert.equal(parseAmount("12300,50"), 12300.5);
  assert.equal(parseAmount("12300.5"), 12300.5);
  assert.equal(parseAmount("12 300"), 12300);
  assert.equal(parseAmount("-500"), -500);
  assert.equal(parseAmount("1.234"), 1.234);
});

test("parseAmount: oba separatory naraz i zapisy błędne", () => {
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("1 234,56"), 1234.56);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("1.234.567,89"), 1234567.89);
  assert.equal(parseAmount("12abc"), null);
  assert.equal(parseAmount("###"), null);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount(null), null);
});
