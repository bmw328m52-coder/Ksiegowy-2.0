"use client";

import { useActionState, useMemo, useState } from "react";
import { calcDeal, type TaxForm } from "@/lib/tax";
import { fmtPLN, parseAmount } from "@/lib/format";
import type { QuoteTemplate } from "@/lib/dao/quote_templates.types";
import { saveQuoteTemplateAction, deleteQuoteTemplateAction } from "./actions";

type JobOption = {
  id: string;
  title: string;
  client_name: string;
  costs_net: number;
  costs_vat: number;
};

type BomLine = { id: string; category: string; amountStr: string };

function makeBomLine(category = ""): BomLine {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
    category,
    amountStr: "",
  };
}

export default function CalculatorForm({
  jobs,
  defaultTaxForm,
  defaultVatRate,
  defaultIsVatPayer,
  defaultYearIncome,
  templates,
  materialCategories,
  defaultZusPelny,
  defaultZusMaly,
  defaultZusUlga,
  initialJobId,
}: {
  jobs: JobOption[];
  defaultTaxForm: TaxForm;
  defaultVatRate: number;
  defaultIsVatPayer: boolean;
  defaultYearIncome: number;
  templates: QuoteTemplate[];
  materialCategories: string[];
  defaultZusPelny: number;
  defaultZusMaly: number;
  defaultZusUlga: number;
  initialJobId?: string;
}) {
  const presetJob = initialJobId ? jobs.find((j) => j.id === initialJobId) : undefined;
  const presetCostsGross = presetJob
    ? presetJob.costs_net + presetJob.costs_vat
    : 0;

  const [amountStr, setAmountStr] = useState("");
  const [vatPct, setVatPct] = useState(String(Math.round(defaultVatRate * 100)));
  const [taxForm, setTaxForm] = useState<TaxForm>(defaultTaxForm);
  const [isVatPayer, setIsVatPayer] = useState<boolean>(defaultIsVatPayer);
  const [yearIncomeStr, setYearIncomeStr] = useState(
    defaultYearIncome > 0 ? defaultYearIncome.toFixed(2) : ""
  );
  const [yearIncomeOverride, setYearIncomeOverride] = useState(false);
  const [costsGrossStr, setCostsGrossStr] = useState(
    presetCostsGross > 0 ? presetCostsGross.toFixed(2) : "",
  );
  const [costsVatPct, setCostsVatPct] = useState("23");
  const [jobId, setJobId] = useState<string>(presetJob ? presetJob.id : "");
  const [useBom, setUseBom] = useState(false);
  const [bomLines, setBomLines] = useState<BomLine[]>([makeBomLine()]);
  const [templateId, setTemplateId] = useState<string>("");
  const [showSave, setShowSave] = useState(false);
  const [pitFlat, setPitFlat] = useState(false);
  const [hoursStr, setHoursStr] = useState("");
  const [zusStr, setZusStr] = useState(defaultZusPelny.toFixed(2));
  const [hoursPerMonthStr, setHoursPerMonthStr] = useState("160");
  const [withInvoice, setWithInvoice] = useState(true);
  const [deductCostsVat, setDeductCostsVat] = useState(false);
  const [reserveVacation, setReserveVacation] = useState(false);
  const [reserveSick, setReserveSick] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saveState, saveAction, savePending] = useActionState(saveQuoteTemplateAction, {
    error: undefined as string | undefined,
  });

  function loadTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setAmountStr(Number(t.amount_gross).toFixed(2));
    setVatPct(String(Math.round(Number(t.vat_rate) * 100)));
    setCostsGrossStr(Number(t.costs_gross).toFixed(2));
    setCostsVatPct(String(Math.round(Number(t.costs_vat_rate) * 100)));
    setTaxForm(t.tax_form);
    setIsVatPayer(t.is_vat_payer);
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Usunąć ten szablon?")) return;
    await deleteQuoteTemplateAction(id);
    if (templateId === id) setTemplateId("");
  }

  function onJobChange(id: string) {
    setJobId(id);
    if (!id) return;
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    const gross = job.costs_net + job.costs_vat;
    setCostsGrossStr(gross > 0 ? gross.toFixed(2) : "");
  }

  const amount = parseAmount(amountStr) ?? 0;
  const yearIncome = parseAmount(yearIncomeStr) ?? 0;
  const bomTotal = useBom
    ? bomLines.reduce((sum, l) => sum + (parseAmount(l.amountStr) ?? 0), 0)
    : 0;
  const costsGross = useBom ? bomTotal : (parseAmount(costsGrossStr) ?? 0);
  const vatRate = Math.max(0, Number(vatPct) / 100) || 0;
  const costsVatRate = isVatPayer ? Math.max(0, Number(costsVatPct) / 100) || 0 : 0;
  const extraCosts = costsVatRate > 0 ? costsGross / (1 + costsVatRate) : costsGross;
  const extraCostsVat = costsGross - extraCosts;

  const result = useMemo(
    () =>
      calcDeal({
        amountGross: amount,
        vatRate,
        costsNet: extraCosts,
        costsVat: extraCostsVat,
        taxForm,
        isVatPayer,
        yearIncomeBefore: yearIncome,
        pitFlat,
      }),
    [amount, vatRate, extraCosts, extraCostsVat, taxForm, isVatPayer, yearIncome, pitFlat]
  );

  const hours = Math.max(0, parseAmount(hoursStr) ?? 0);
  const zusMonthly = Math.max(0, parseAmount(zusStr) ?? 0);
  const hoursPerMonth = Math.max(1, parseAmount(hoursPerMonthStr) ?? 160);
  const zusForJob = withInvoice ? (zusMonthly / hoursPerMonth) * hours : 0;
  // Bez faktury: koszt = brutto. Jeśli VATowiec może odliczyć VAT od kosztów, efektywny koszt = netto.
  const canDeductVat = !withInvoice && isVatPayer && deductCostsVat;
  const recoveredVat = canDeductVat ? extraCostsVat : 0;
  const profitNoInvoice = amount - costsGross + recoveredVat;
  const netCashAfterZus = withInvoice ? result.netCash - zusForJob : profitNoInvoice;
  // Rezerwa: 26 dni urlopu × 8 h = 208 h, 10 dni L4 × 8 h = 80 h, na rok 1728 h produktywnych
  const reserveRatio = ((reserveVacation ? 208 : 0) + (reserveSick ? 80 : 0)) / 1728;
  const reserveAmount = netCashAfterZus * reserveRatio;
  const netCashAfterReserves = netCashAfterZus - reserveAmount;
  const ratePerHour = hours > 0 ? netCashAfterReserves / hours : 0;
  const ratePerHourBeforeTaxes = hours > 0
    ? (withInvoice ? result.profit : profitNoInvoice) / hours
    : 0;

  return (
    <div className="flex flex-col gap-5">
      <Section title="Szablony">
        <div className="flex gap-2">
          <select
            value={templateId}
            onChange={(e) => loadTemplate(e.target.value)}
            className="input flex-1"
          >
            <option value="">— wybierz szablon —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {templateId && (
            <button
              type="button"
              onClick={() => deleteTemplate(templateId)}
              className="rounded-lg border border-red-200 text-red-600 text-xs px-3 active:bg-red-50"
              aria-label="Usuń szablon"
            >
              Usuń
            </button>
          )}
        </div>

        {!showSave ? (
          <button
            type="button"
            onClick={() => {
              setShowSave(true);
              setTemplateName("");
            }}
            className="rounded-lg border border-zinc-200 bg-white text-sm py-2 active:bg-zinc-50"
          >
            + Zapisz aktualne ustawienia jako szablon
          </button>
        ) : (
          <form action={saveAction} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
            <input type="hidden" name="amount_gross" value={amountStr || "0"} />
            <input type="hidden" name="vat_rate" value={(Number(vatPct) / 100).toString()} />
            <input type="hidden" name="costs_gross" value={costsGrossStr || "0"} />
            <input type="hidden" name="costs_vat_rate" value={(Number(costsVatPct) / 100).toString()} />
            <input type="hidden" name="tax_form" value={taxForm} />
            <input type="hidden" name="is_vat_payer" value={isVatPayer ? "true" : "false"} />
            <input
              name="name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="np. Szafa 3-drzwiowa dąb"
              required
              className="input"
            />
            {saveState.error && (
              <p className="text-xs text-red-600">{saveState.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savePending || !templateName.trim()}
                onClick={() => setShowSave(false)}
                className="flex-1 rounded-lg bg-accent text-white text-sm py-2 font-medium active:opacity-80 disabled:opacity-50"
              >
                {savePending ? "Zapisuję..." : "Zapisz"}
              </button>
              <button
                type="button"
                onClick={() => setShowSave(false)}
                className="rounded-lg border border-zinc-200 text-sm px-3 active:bg-zinc-50"
              >
                Anuluj
              </button>
            </div>
          </form>
        )}
      </Section>

      <Section title="Tryb rozliczenia">
        <div className="grid grid-cols-2 gap-2">
          <RadioCard
            checked={withInvoice}
            onChange={() => setWithInvoice(true)}
            label="Z fakturą"
            hint="VAT, PIT, ZUS"
          />
          <RadioCard
            checked={!withInvoice}
            onChange={() => setWithInvoice(false)}
            label="Bez faktury"
            hint="kasa do ręki"
          />
        </div>
        {!withInvoice && isVatPayer && (
          <label className="flex items-center gap-2 text-xs text-zinc-700 select-none mt-1">
            <input
              type="checkbox"
              checked={deductCostsVat}
              onChange={(e) => setDeductCostsVat(e.target.checked)}
            />
            <span>
              Odlicz VAT od kosztów (faktury kosztowe trafiają do JPK)
            </span>
          </label>
        )}
      </Section>

      <Section title="Kwota zlecenia">
        <Field label="Kwota brutto (PLN)">
          <input
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="np. 12300"
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stawka VAT (%)">
            <select
              value={vatPct}
              onChange={(e) => setVatPct(e.target.value)}
              className="input"
              disabled={!isVatPayer}
            >
              <option value="23">23%</option>
              <option value="8">8%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </Field>
          <Field label="VAT-owiec">
            <label className="flex items-center gap-2 h-[42px] px-3 rounded-lg border border-zinc-200 bg-white">
              <input
                type="checkbox"
                checked={isVatPayer}
                onChange={(e) => setIsVatPayer(e.target.checked)}
              />
              <span className="text-sm">{isVatPayer ? "Tak" : "Nie"}</span>
            </label>
          </Field>
        </div>
      </Section>

      <Section title="Koszty">
        <Field label="Zlecenie (opcjonalnie)">
          <select value={jobId} onChange={(e) => onJobChange(e.target.value)} className="input">
            <option value="">— bez przypisania —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.client_name})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500 mt-1">
            Po wyborze zlecenia pola kosztów uzupełnią się automatycznie sumą faktur kosztowych. Możesz je nadpisać.
          </p>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Koszty brutto (PLN)">
            <input
              inputMode="decimal"
              value={useBom ? (bomTotal > 0 ? bomTotal.toFixed(2) : "") : costsGrossStr}
              onChange={(e) => setCostsGrossStr(e.target.value)}
              placeholder={useBom ? "z pozycji BOM" : "np. 5535"}
              className="input"
              disabled={useBom}
            />
          </Field>
          <Field label="VAT kosztów (%)">
            <select
              value={costsVatPct}
              onChange={(e) => setCostsVatPct(e.target.value)}
              className="input"
              disabled={!isVatPayer}
            >
              <option value="23">23%</option>
              <option value="8">8%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </Field>
        </div>
        {costsGross > 0 && (
          <p className="text-[11px] text-zinc-500 -mt-1">
            Netto: <span className="tabular-nums font-medium">{fmtPLN(extraCosts)}</span>
            {isVatPayer && (
              <>
                {" · VAT: "}
                <span className="tabular-nums font-medium">{fmtPLN(extraCostsVat)}</span>
              </>
            )}
          </p>
        )}

        <label className="flex items-center gap-2 text-xs text-zinc-700 select-none mt-1">
          <input
            type="checkbox"
            checked={useBom}
            onChange={(e) => {
              const v = e.target.checked;
              setUseBom(v);
              if (v && bomLines.length === 0) setBomLines([makeBomLine()]);
            }}
          />
          <span>Rozpisz koszty po pozycjach (BOM)</span>
        </label>

        {useBom && (
          <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
            {bomLines.map((line, idx) => (
              <div key={line.id} className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <input
                    list="bom-categories"
                    value={line.category}
                    onChange={(e) =>
                      setBomLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, category: e.target.value } : l))
                      )
                    }
                    placeholder="kategoria"
                    className="input"
                  />
                </div>
                <div className="w-28 shrink-0">
                  <input
                    inputMode="decimal"
                    value={line.amountStr}
                    onChange={(e) =>
                      setBomLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, amountStr: e.target.value } : l))
                      )
                    }
                    placeholder="brutto"
                    className="input text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBomLines((prev) =>
                      prev.length === 1 ? [makeBomLine()] : prev.filter((_, i) => i !== idx)
                    )
                  }
                  className="h-[42px] w-9 shrink-0 rounded-lg border border-zinc-200 text-zinc-500 active:bg-zinc-50"
                  aria-label="Usuń pozycję"
                >
                  ×
                </button>
              </div>
            ))}
            <datalist id="bom-categories">
              {materialCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => setBomLines((prev) => [...prev, makeBomLine()])}
              className="w-full rounded-lg border border-dashed border-zinc-300 text-sm py-2 text-zinc-600 active:bg-zinc-50"
            >
              + Dodaj pozycję
            </button>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs">
              <span className="text-zinc-500">Suma BOM (brutto)</span>
              <span className="tabular-nums font-semibold">{fmtPLN(bomTotal)}</span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Podatek dochodowy">
        <Field label="Forma opodatkowania">
          <div className="grid grid-cols-2 gap-2">
            <RadioCard
              checked={taxForm === "skala"}
              onChange={() => setTaxForm("skala")}
              label="Skala"
              hint="12% / 32%"
            />
            <RadioCard
              checked={taxForm === "liniowy"}
              onChange={() => setTaxForm("liniowy")}
              label="Liniowy"
              hint="19%"
            />
          </div>
        </Field>
        <Field label="Sposób liczenia PIT">
          <div className="grid grid-cols-2 gap-2">
            <RadioCard
              checked={!pitFlat}
              onChange={() => setPitFlat(false)}
              label="Z kwotą wolną"
              hint={taxForm === "skala" ? "30k wolne, próg 120k" : "Liniowy bez kwoty wolnej"}
            />
            <RadioCard
              checked={pitFlat}
              onChange={() => setPitFlat(true)}
              label="Bezpiecznie"
              hint={taxForm === "skala" ? "12% od 0 zł" : "19% od 0 zł"}
            />
          </div>
        </Field>
        {taxForm === "skala" && !pitFlat && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span>Dochód roczny dotychczas:</span>
              <span className="font-medium tabular-nums text-zinc-900">
                {fmtPLN(parseAmount(yearIncomeStr) ?? 0)}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              {yearIncomeOverride
                ? "Wartość ręczna."
                : defaultYearIncome > 0
                  ? "Pobrano automatycznie z dashboardu (YTD)."
                  : "Brak danych w bazie — wpisz ręcznie, jeśli chcesz."}
            </p>
            {!yearIncomeOverride ? (
              <button
                type="button"
                onClick={() => setYearIncomeOverride(true)}
                className="text-[11px] text-zinc-700 underline-offset-2 hover:underline"
              >
                Nadpisz ręcznie
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  inputMode="decimal"
                  value={yearIncomeStr}
                  onChange={(e) => setYearIncomeStr(e.target.value)}
                  placeholder="0"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    setYearIncomeOverride(false);
                    setYearIncomeStr(
                      defaultYearIncome > 0 ? defaultYearIncome.toFixed(2) : ""
                    );
                  }}
                  className="text-[11px] text-zinc-600 underline-offset-2 hover:underline"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Stawka godzinowa (opcjonalnie)">
        <Field label="Liczba godzin na zlecenie">
          <input
            inputMode="decimal"
            value={hoursStr}
            onChange={(e) => setHoursStr(e.target.value)}
            placeholder="np. 40"
            className="input"
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-zinc-600">Rezerwa wolnego (odejmowana od stawki)</span>
          <label className="flex items-center gap-2 text-sm text-zinc-700 select-none">
            <input
              type="checkbox"
              checked={reserveVacation}
              onChange={(e) => setReserveVacation(e.target.checked)}
            />
            <span>Urlop (26 dni × 8 h / rok)</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 select-none">
            <input
              type="checkbox"
              checked={reserveSick}
              onChange={(e) => setReserveSick(e.target.checked)}
            />
            <span>L4 (10 dni × 8 h / rok)</span>
          </label>
        </div>

        {withInvoice && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Miesięczny ZUS (PLN)">
                <input
                  inputMode="decimal"
                  value={zusStr}
                  onChange={(e) => setZusStr(e.target.value)}
                  placeholder="np. 1900"
                  className="input"
                />
              </Field>
              <Field label="Godzin pracy / mies.">
                <input
                  inputMode="decimal"
                  value={hoursPerMonthStr}
                  onChange={(e) => setHoursPerMonthStr(e.target.value)}
                  placeholder="160"
                  className="input"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ZusPreset label="Ulga" amount={defaultZusUlga} onPick={setZusStr} />
              <ZusPreset label="Mały" amount={defaultZusMaly} onPick={setZusStr} />
              <ZusPreset label="Pełny" amount={defaultZusPelny} onPick={setZusStr} />
            </div>
          </>
        )}

        {hours > 0 && (
          <HourlyRatePanel
            withInvoice={withInvoice}
            hours={hours}
            zusForJob={zusForJob}
            zusMonthly={zusMonthly}
            hoursPerMonth={hoursPerMonth}
            netCash={result.netCash}
            netCashAfterZus={netCashAfterZus}
            netCashAfterReserves={netCashAfterReserves}
            reserveAmount={reserveAmount}
            reserveVacation={reserveVacation}
            reserveSick={reserveSick}
            ratePerHour={ratePerHour}
            ratePerHourBeforeTaxes={ratePerHourBeforeTaxes}
            amountGross={amount}
            costsGross={costsGross}
            recoveredVat={recoveredVat}
          />
        )}
      </Section>

      <ResultPanel
        result={result}
        amountGross={amount}
        costsGross={costsGross}
        costsNet={extraCosts}
        costsVat={extraCostsVat}
        isVatPayer={isVatPayer}
        withInvoice={withInvoice}
        profitNoInvoice={profitNoInvoice}
        recoveredVat={recoveredVat}
      />

      <p className="text-[11px] text-zinc-500 text-center">
        To nie porada podatkowa — wyliczenie poglądowe. Skonsultuj z księgową.
      </p>

      <style jsx>{`
        .input {
          width: 100%;
          height: 42px;
          padding: 0 12px;
          border-radius: 0.5rem;
          border: 1px solid #e4e4e7;
          background: white;
          font-size: 16px;
        }
        .input:focus {
          outline: 2px solid #282624;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

function ZusPreset({
  label,
  amount,
  onPick,
}: {
  label: string;
  amount: number;
  onPick: (s: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(amount.toFixed(2))}
      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 active:bg-zinc-50"
    >
      {label}: {fmtPLN(amount)}
    </button>
  );
}

function HourlyRatePanel({
  withInvoice,
  hours,
  zusForJob,
  zusMonthly,
  hoursPerMonth,
  netCash,
  netCashAfterZus,
  netCashAfterReserves,
  reserveAmount,
  reserveVacation,
  reserveSick,
  ratePerHour,
  ratePerHourBeforeTaxes,
  amountGross,
  costsGross,
  recoveredVat,
}: {
  withInvoice: boolean;
  hours: number;
  zusForJob: number;
  zusMonthly: number;
  hoursPerMonth: number;
  netCash: number;
  netCashAfterZus: number;
  netCashAfterReserves: number;
  reserveAmount: number;
  reserveVacation: boolean;
  reserveSick: boolean;
  ratePerHour: number;
  ratePerHourBeforeTaxes: number;
  amountGross: number;
  costsGross: number;
  recoveredVat: number;
}) {
  const positive = ratePerHour >= 0;
  const reserveActive = reserveVacation || reserveSick;
  const reserveLabel = [reserveVacation ? "urlop" : null, reserveSick ? "L4" : null]
    .filter(Boolean)
    .join(" + ");
  const tagBase = withInvoice ? "po VAT, PIT i ZUS" : "kwota − koszty (gotówka)";
  return (
    <div className="space-y-2">
      <div
        className={`rounded-2xl border p-4 ${
          positive ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
        }`}
      >
        <p
          className={`text-xs font-medium uppercase tracking-wide ${
            positive ? "text-emerald-700" : "text-red-700"
          }`}
        >
          Stawka na rękę / godzinę {withInvoice ? "" : "(bez faktury)"}
        </p>
        <p
          className={`text-3xl font-bold tabular-nums mt-1 ${
            positive ? "text-emerald-900" : "text-red-900"
          }`}
        >
          {fmtPLN(ratePerHour)}
        </p>
        <p
          className={`text-[11px] mt-1 ${
            positive ? "text-emerald-700/80" : "text-red-700/80"
          }`}
        >
          {hours} h · {reserveActive ? `${tagBase}, po rezerwie ${reserveLabel}` : tagBase}
        </p>
      </div>

      <details className="rounded-xl border border-zinc-200 bg-white overflow-hidden group">
        <summary className="flex items-center justify-between px-4 py-3 text-sm text-zinc-700 cursor-pointer select-none active:bg-zinc-50 list-none">
          <span className="font-medium">Pokaż rozliczenie godzinowe</span>
          <span className="text-xs text-zinc-400 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="border-t border-zinc-100">
          {withInvoice ? (
            <>
              <Row label="Na czysto (po VAT, PIT)" value={fmtPLN(netCash)} />
              <Row
                label={`− ZUS proporcjonalny (${fmtPLN(zusMonthly)}/${hoursPerMonth}h × ${hours}h)`}
                value={`− ${fmtPLN(zusForJob)}`}
                sub
              />
              <Row label="= Na rękę po ZUS" value={fmtPLN(netCashAfterZus)} bold />
              {reserveActive && (
                <Row
                  label={`− Rezerwa ${reserveLabel}`}
                  value={`− ${fmtPLN(reserveAmount)}`}
                  sub
                />
              )}
              {reserveActive && (
                <Row label="= Po rezerwie" value={fmtPLN(netCashAfterReserves)} bold />
              )}
              <Row label="Stawka brutto/h (przed PIT)" value={fmtPLN(ratePerHourBeforeTaxes)} sub />
              <Row label="Stawka na rękę/h" value={fmtPLN(ratePerHour)} highlight />
            </>
          ) : (
            <>
              <Row label="Kwota od klienta (gotówka)" value={fmtPLN(amountGross)} />
              <Row label="− Koszty brutto" value={`− ${fmtPLN(costsGross)}`} sub />
              {recoveredVat > 0 && (
                <Row
                  label="+ VAT do odzyskania (z JPK)"
                  value={`+ ${fmtPLN(recoveredVat)}`}
                  sub
                />
              )}
              <Row label="= Do kieszeni" value={fmtPLN(netCashAfterZus)} bold />
              {reserveActive && (
                <Row
                  label={`− Rezerwa ${reserveLabel}`}
                  value={`− ${fmtPLN(reserveAmount)}`}
                  sub
                />
              )}
              {reserveActive && (
                <Row label="= Po rezerwie" value={fmtPLN(netCashAfterReserves)} bold />
              )}
              <Row label="Stawka na rękę/h" value={fmtPLN(ratePerHour)} highlight />
            </>
          )}
        </div>
      </details>
    </div>
  );
}

function RadioCard({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`rounded-lg border p-3 text-left active:bg-zinc-50 ${
        checked ? "border-accent bg-zinc-50" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-zinc-500">{hint}</div>
    </button>
  );
}

function ResultPanel({
  result,
  amountGross,
  costsGross,
  costsNet,
  costsVat,
  isVatPayer,
  withInvoice,
  profitNoInvoice,
  recoveredVat,
}: {
  result: ReturnType<typeof calcDeal>;
  amountGross: number;
  costsGross: number;
  costsNet: number;
  costsVat: number;
  isVatPayer: boolean;
  withInvoice: boolean;
  profitNoInvoice: number;
  recoveredVat: number;
}) {
  const { revenueNet, revenueVat, profit, vatToPay, pitDelta, netCash } = result;
  const taxTotal = vatToPay + pitDelta;
  const empty = amountGross === 0 && costsGross === 0;
  const displayCash = withInvoice ? netCash : profitNoInvoice;
  const recovered = recoveredVat > 0;

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          {withInvoice ? "Na czysto (po VAT i PIT)" : "Na czysto (gotówka, bez faktury)"}
        </p>
        <p className="text-3xl font-bold tabular-nums text-emerald-900 mt-1">
          {fmtPLN(displayCash)}
        </p>
        {!withInvoice && (
          <p className="text-[11px] text-emerald-700/80 mt-1">
            {recovered
              ? "kwota − koszty + zwrot VAT · brak PIT"
              : "kwota − koszty · brak VAT i PIT"}
          </p>
        )}
      </div>

      {withInvoice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
              Razem podatki {isVatPayer ? "(VAT + PIT)" : "(PIT)"}
            </p>
            <p className="text-xl font-semibold tabular-nums text-amber-900">
              {fmtPLN(taxTotal)}
            </p>
          </div>
          <div className="mt-2 space-y-1 text-xs text-amber-900/80">
            {isVatPayer && (
              <div className="flex items-baseline justify-between">
                <span>VAT do zapłaty</span>
                <span className="tabular-nums">{fmtPLN(vatToPay)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span>PIT (przyrost roczny)</span>
              <span className="tabular-nums">{fmtPLN(pitDelta)}</span>
            </div>
          </div>
        </div>
      )}

      {!empty && (
        <details className="rounded-xl border border-zinc-200 bg-white overflow-hidden group">
          <summary className="flex items-center justify-between px-4 py-3 text-sm text-zinc-700 cursor-pointer select-none active:bg-zinc-50 list-none">
            <span className="font-medium">Pokaż szczegóły wyliczenia</span>
            <span className="text-xs text-zinc-400 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="border-t border-zinc-100">
            {withInvoice ? (
              <>
                <GroupHeader>Sprzedaż</GroupHeader>
                <Row label="Brutto (z VAT)" value={fmtPLN(amountGross)} />
                {isVatPayer && <Row label="− VAT należny" value={fmtPLN(revenueVat)} sub />}
                <Row
                  label={isVatPayer ? "= Netto (po VAT)" : "Netto"}
                  value={fmtPLN(revenueNet)}
                />
                <GroupHeader>Koszty</GroupHeader>
                <Row label="Brutto" value={fmtPLN(costsGross)} />
                {isVatPayer && <Row label="− VAT naliczony" value={fmtPLN(costsVat)} sub />}
                <Row
                  label={isVatPayer ? "= Netto (do PIT)" : "Netto"}
                  value={fmtPLN(costsNet)}
                />
                <GroupHeader>Zysk</GroupHeader>
                <Row label="Zysk netto" value={fmtPLN(profit)} bold />
                <Row label="Podstawa do PIT" value={fmtPLN(Math.max(0, profit))} sub />
              </>
            ) : (
              <>
                <GroupHeader>Gotówka</GroupHeader>
                <Row label="Kwota od klienta" value={fmtPLN(amountGross)} />
                <Row label="− Koszty brutto" value={`− ${fmtPLN(costsGross)}`} sub />
                {recovered && (
                  <Row
                    label="+ VAT do odzyskania (z JPK)"
                    value={`+ ${fmtPLN(recoveredVat)}`}
                    sub
                  />
                )}
                <Row label="= Do kieszeni" value={fmtPLN(profitNoInvoice)} bold />
              </>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 bg-zinc-50 border-b border-zinc-100">
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  sub = false,
  negative = false,
  highlight = false,
  tax = false,
  bold = false,
}: {
  label: string;
  value: string;
  sub?: boolean;
  negative?: boolean;
  highlight?: boolean;
  tax?: boolean;
  bold?: boolean;
}) {
  const bg = highlight ? "bg-emerald-50" : tax ? "bg-amber-50" : bold ? "bg-zinc-50" : "";
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-zinc-100 ${bg}`}
    >
      <span className={`text-sm ${sub ? "text-zinc-500" : "text-zinc-700"}`}>{label}</span>
      <span
        className={`tabular-nums ${
          highlight
            ? "text-emerald-700 text-lg font-semibold"
            : tax
              ? "text-amber-800 text-lg font-semibold"
              : bold
                ? "text-zinc-900 text-base font-semibold"
                : negative
                  ? "text-zinc-700 font-medium"
                  : "text-zinc-900 font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
