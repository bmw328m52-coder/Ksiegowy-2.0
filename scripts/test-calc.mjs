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
for (const name of ["tax", "zus", "profitability"]) {
  const src = fs.readFileSync(path.join(libDir, `${name}.ts`), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.writeFileSync(path.join(outDir, `${name}.js`), js);
}
const { calcJobProfit, requiredPriceGross, rateStatus, requiredHourlyRate } = require(
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
