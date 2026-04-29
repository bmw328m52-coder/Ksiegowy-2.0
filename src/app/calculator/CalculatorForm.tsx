"use client";

import { useMemo, useState } from "react";
import { calcDeal, type TaxForm } from "@/lib/tax";
import { fmtPLN, parseAmount } from "@/lib/format";

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
}: {
  jobs: JobOption[];
  defaultTaxForm: TaxForm;
  defaultVatRate: number;
  defaultIsVatPayer: boolean;
}) {
  const [amountStr, setAmountStr] = useState("");
  const [vatPct, setVatPct] = useState(String(Math.round(defaultVatRate * 100)));
  const [taxForm, setTaxForm] = useState<TaxForm>(defaultTaxForm);
  const [isVatPayer, setIsVatPayer] = useState<boolean>(defaultIsVatPayer);
  const [yearIncomeStr, setYearIncomeStr] = useState("");
  const [costsGrossStr, setCostsGrossStr] = useState("");
  const [costsVatPct, setCostsVatPct] = useState("23");
  const [jobId, setJobId] = useState<string>("");

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
        <Field label="Dochód roczny do tej pory (PLN)">
          <input
            inputMode="decimal"
            value={yearIncomeStr}
            onChange={(e) => setYearIncomeStr(e.target.value)}
            placeholder="0"
            className="input"
          />
          <p className="text-[11px] text-zinc-500 mt-1">
            Potrzebne tylko dla skali — żeby uwzględnić kwotę wolną i próg 120 000.
          </p>
        </Field>
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

  return (
    <section className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <GroupHeader>Sprzedaż</GroupHeader>
      <Row label="Brutto (z VAT)" value={fmtPLN(amountGross)} />
      {isVatPayer && (
        <Row label="− VAT należny" value={fmtPLN(revenueVat)} sub />
      )}
      <Row
        label={isVatPayer ? "= Netto (po VAT)" : "Netto"}
        value={fmtPLN(revenueNet)}
      />

      <GroupHeader>Koszty</GroupHeader>
      <Row label="Brutto" value={fmtPLN(costsGross)} />
      {isVatPayer && (
        <Row label="− VAT naliczony" value={fmtPLN(costsVat)} sub />
      )}
      <Row
        label={isVatPayer ? "= Netto (do PIT)" : "Netto"}
        value={fmtPLN(costsNet)}
      />

      <GroupHeader>Zysk</GroupHeader>
      <Row
        label="Zysk netto (przychód netto − koszty netto)"
        value={fmtPLN(profit)}
        bold
      />
      <Row
        label="Podstawa do PIT"
        value={fmtPLN(Math.max(0, profit))}
        sub
      />

      <GroupHeader>Podatki do zapłacenia</GroupHeader>
      {isVatPayer && (
        <Row label="VAT do zapłaty" value={fmtPLN(vatToPay)} />
      )}
      <Row label="PIT (przyrost roczny)" value={fmtPLN(pitDelta)} />
      <Row label="Razem (VAT + PIT)" value={fmtPLN(taxTotal)} tax />

      <Row
        label="Na czysto (po VAT i PIT)"
        value={fmtPLN(netCash)}
        highlight
      />
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
