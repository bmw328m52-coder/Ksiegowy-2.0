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

export default function CalculatorForm({
  jobs,
  defaultTaxForm,
  defaultVatRate,
  defaultIsVatPayer,
  defaultYearIncome,
  templates,
}: {
  jobs: JobOption[];
  defaultTaxForm: TaxForm;
  defaultVatRate: number;
  defaultIsVatPayer: boolean;
  defaultYearIncome: number;
  templates: QuoteTemplate[];
}) {
  const [amountStr, setAmountStr] = useState("");
  const [vatPct, setVatPct] = useState(String(Math.round(defaultVatRate * 100)));
  const [taxForm, setTaxForm] = useState<TaxForm>(defaultTaxForm);
  const [isVatPayer, setIsVatPayer] = useState<boolean>(defaultIsVatPayer);
  const [yearIncomeStr, setYearIncomeStr] = useState(
    defaultYearIncome > 0 ? defaultYearIncome.toFixed(2) : ""
  );
  const [yearIncomeOverride, setYearIncomeOverride] = useState(false);
  const [costsGrossStr, setCostsGrossStr] = useState("");
  const [costsVatPct, setCostsVatPct] = useState("23");
  const [jobId, setJobId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [showSave, setShowSave] = useState(false);
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
  const costsGross = parseAmount(costsGrossStr) ?? 0;
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
      }),
    [amount, vatRate, extraCosts, extraCostsVat, taxForm, isVatPayer, yearIncome]
  );

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
                className="flex-1 rounded-lg bg-[#282624] text-white text-sm py-2 font-medium active:opacity-80 disabled:opacity-50"
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
              value={costsGrossStr}
              onChange={(e) => setCostsGrossStr(e.target.value)}
              placeholder="np. 5535"
              className="input"
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
        {taxForm === "skala" && (
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

      <ResultPanel
        result={result}
        amountGross={amount}
        costsGross={costsGross}
        costsNet={extraCosts}
        costsVat={extraCostsVat}
        isVatPayer={isVatPayer}
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
        checked ? "border-[#282624] bg-zinc-50" : "border-zinc-200 bg-white"
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
}: {
  result: ReturnType<typeof calcDeal>;
  amountGross: number;
  costsGross: number;
  costsNet: number;
  costsVat: number;
  isVatPayer: boolean;
}) {
  const { revenueNet, revenueVat, profit, vatToPay, pitDelta, netCash } = result;
  const taxTotal = vatToPay + pitDelta;
  const empty = amountGross === 0 && costsGross === 0;

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          Na czysto (po VAT i PIT)
        </p>
        <p className="text-3xl font-bold tabular-nums text-emerald-900 mt-1">
          {fmtPLN(netCash)}
        </p>
      </div>

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

      {!empty && (
        <details className="rounded-xl border border-zinc-200 bg-white overflow-hidden group">
          <summary className="flex items-center justify-between px-4 py-3 text-sm text-zinc-700 cursor-pointer select-none active:bg-zinc-50 list-none">
            <span className="font-medium">Pokaż szczegóły wyliczenia</span>
            <span className="text-xs text-zinc-400 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="border-t border-zinc-100">
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
