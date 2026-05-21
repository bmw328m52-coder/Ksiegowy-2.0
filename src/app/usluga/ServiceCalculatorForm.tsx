"use client";

import { useMemo, useState } from "react";
import { fmtPLN, parseAmount } from "@/lib/format";
import { pitFor, type TaxForm } from "@/lib/tax";

// 12 miesięcy × 168 h - 26 dni urlopu × 8 h - 10 dni L4 × 8 h
const ANNUAL_HOURS = 2016;
const VACATION_HOURS = 26 * 8;
const SICK_HOURS = 10 * 8;
const PRODUCTIVE_HOURS_YEAR = ANNUAL_HOURS - VACATION_HOURS - SICK_HOURS; // 1728
const PRODUCTIVE_HOURS_MONTH = PRODUCTIVE_HOURS_YEAR / 12; // 144

type ExtraLine = { id: string; label: string; amountStr: string };

function makeLine(label = ""): ExtraLine {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
    label,
    amountStr: "",
  };
}

type Props = {
  defaultHourlyRate: number;
  defaultZusMonthly: number;
  defaultZusPelny: number;
  defaultZusMaly: number;
  defaultZusUlga: number;
  defaultVatRate: number;
  defaultIsVatPayer: boolean;
  defaultTaxForm: TaxForm;
};

export default function ServiceCalculatorForm({
  defaultHourlyRate,
  defaultZusMonthly,
  defaultZusPelny,
  defaultZusMaly,
  defaultZusUlga,
  defaultVatRate,
  defaultIsVatPayer,
  defaultTaxForm,
}: Props) {
  const [hoursStr, setHoursStr] = useState("");
  const [rateStr, setRateStr] = useState(String(defaultHourlyRate));
  const [zusStr, setZusStr] = useState(
    defaultZusMonthly > 0 ? defaultZusMonthly.toFixed(2) : defaultZusPelny.toFixed(2)
  );
  const [withInvoice, setWithInvoice] = useState(false);
  const [vatPctStr, setVatPctStr] = useState(String(Math.round(defaultVatRate * 100)));
  const [pitPctStr, setPitPctStr] = useState(defaultTaxForm === "liniowy" ? "19" : "12");
  const [pitMode, setPitMode] = useState<"safe" | "scale">("safe");
  const [yearIncomeStr, setYearIncomeStr] = useState("");
  const [includeVacation, setIncludeVacation] = useState(true);
  const [includeSick, setIncludeSick] = useState(true);
  const [extras, setExtras] = useState<ExtraLine[]>([]);
  const [deductCostsVat, setDeductCostsVat] = useState(false);
  const [costsVatPctStr, setCostsVatPctStr] = useState("23");

  const hours = Math.max(0, parseAmount(hoursStr) ?? 0);
  const rate = Math.max(0, parseAmount(rateStr) ?? 0);
  const zusMonthly = Math.max(0, parseAmount(zusStr) ?? 0);
  const vatRate = Math.max(0, (Number(vatPctStr) || 0) / 100);
  const costsVatRate = Math.max(0, (Number(costsVatPctStr) || 0) / 100);
  const pitRateFlat = Math.max(0, Math.min(0.99, (Number(pitPctStr) || 0) / 100));
  const yearIncomeBefore = Math.max(0, parseAmount(yearIncomeStr) ?? 0);
  const canDeductVat = !withInvoice && defaultIsVatPayer && deductCostsVat;

  const result = useMemo(() => {
    const vacationPerH = includeVacation ? (VACATION_HOURS * rate) / PRODUCTIVE_HOURS_YEAR : 0;
    const sickPerH = includeSick ? (SICK_HOURS * rate) / PRODUCTIVE_HOURS_YEAR : 0;
    const takeHomePerH = rate + vacationPerH + sickPerH;
    const zusPerH = zusMonthly / PRODUCTIVE_HOURS_MONTH;

    const baseAmount = rate * hours;
    const vacationAmount = vacationPerH * hours;
    const sickAmount = sickPerH * hours;
    const zusAmount = zusPerH * hours;
    const extrasAmount = extras.reduce((s, e) => s + (parseAmount(e.amountStr) ?? 0), 0);

    if (!withInvoice) {
      const totalLabor = baseAmount + vacationAmount + sickAmount + zusAmount;
      const total = totalLabor + extrasAmount;
      const recoveredVat =
        canDeductVat && costsVatRate > 0
          ? extrasAmount - extrasAmount / (1 + costsVatRate)
          : 0;
      return {
        baseAmount,
        vacationAmount,
        sickAmount,
        zusAmount,
        extrasAmount,
        pitAmount: 0,
        netto: 0,
        vatAmount: 0,
        brutto: 0,
        totalLabor,
        total,
        recoveredVat,
        effectiveProfit: total + recoveredVat,
        rateEffectivePerH: hours > 0 ? total / hours : 0,
        takeHomePerH,
      };
    }

    // Z fakturą:
    // netto = dochód + zus + extras  (zus i extras to koszty uzyskania)
    // dochód taki, żeby po PIT zostało take_home_target
    const takeHomeTarget = takeHomePerH * hours;
    let dochod = 0;
    let pitAmount = 0;
    if (pitMode === "safe") {
      // Płaska stawka od 0 — dochód × (1 - rate) = take_home
      dochod = pitRateFlat < 1 ? takeHomeTarget / (1 - pitRateFlat) : 0;
      pitAmount = dochod * pitRateFlat;
    } else {
      // Z kwotą wolną i progami — solver binarny po dochodzie
      let lo = 0;
      let hi = Math.max(takeHomeTarget * 2, 10000) + 1_000_000;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const pit =
          pitFor(defaultTaxForm, yearIncomeBefore + mid) - pitFor(defaultTaxForm, yearIncomeBefore);
        const cash = mid - pit;
        if (cash < takeHomeTarget) lo = mid;
        else hi = mid;
      }
      dochod = (lo + hi) / 2;
      pitAmount =
        pitFor(defaultTaxForm, yearIncomeBefore + dochod) - pitFor(defaultTaxForm, yearIncomeBefore);
    }
    const netto = dochod + zusAmount + extrasAmount;
    const vatAmount = netto * vatRate;
    const brutto = netto + vatAmount;

    return {
      baseAmount,
      vacationAmount,
      sickAmount,
      zusAmount,
      extrasAmount,
      pitAmount,
      netto,
      vatAmount,
      brutto,
      totalLabor: baseAmount + vacationAmount + sickAmount + zusAmount + pitAmount,
      total: brutto,
      recoveredVat: 0,
      effectiveProfit: brutto,
      rateEffectivePerH: hours > 0 ? brutto / hours : 0,
      takeHomePerH,
    };
  }, [
    hours,
    rate,
    zusMonthly,
    extras,
    withInvoice,
    vatRate,
    pitRateFlat,
    pitMode,
    yearIncomeBefore,
    defaultTaxForm,
    includeVacation,
    includeSick,
    canDeductVat,
    costsVatRate,
  ]);

  const empty = hours === 0;

  return (
    <div className="flex flex-col gap-5">
      <Section title="Usługa">
        <Field label="Liczba godzin">
          <input
            inputMode="decimal"
            value={hoursStr}
            onChange={(e) => setHoursStr(e.target.value)}
            placeholder="np. 3"
            className="input"
            autoFocus
          />
        </Field>
        <Field label="Stawka „na rękę” (PLN/h)">
          <input
            inputMode="decimal"
            value={rateStr}
            onChange={(e) => setRateStr(e.target.value)}
            placeholder="50"
            className="input"
          />
          <span className="text-[11px] text-zinc-500">
            Tyle chcesz mieć w kieszeni za 1 h pracy. Domyślną stawkę zmienisz w Ustawieniach.
          </span>
        </Field>
      </Section>

      <Section title="Tryb">
        <div className="grid grid-cols-2 gap-2">
          <RadioCard
            checked={!withInvoice}
            onChange={() => setWithInvoice(false)}
            label="Bez faktury"
            hint="Gotówka, bez VAT/PIT"
          />
          <RadioCard
            checked={withInvoice}
            onChange={() => setWithInvoice(true)}
            label="Z fakturą"
            hint="VAT + PIT od dochodu"
          />
        </div>
        {!withInvoice && defaultIsVatPayer && (
          <>
            <label className="flex items-center gap-2 text-xs text-zinc-700 select-none mt-1">
              <input
                type="checkbox"
                checked={deductCostsVat}
                onChange={(e) => setDeductCostsVat(e.target.checked)}
              />
              <span>Odlicz VAT od materiałów (faktury kosztowe trafiają do JPK)</span>
            </label>
            {deductCostsVat && (
              <Field label="VAT na materiały (%)">
                <input
                  inputMode="decimal"
                  value={costsVatPctStr}
                  onChange={(e) => setCostsVatPctStr(e.target.value)}
                  className="input"
                />
                <span className="text-[11px] text-zinc-500">
                  Pozycje „Materiały / dodatkowe” traktujemy jako brutto. VAT odzyskasz z JPK.
                </span>
              </Field>
            )}
          </>
        )}
      </Section>

      <Section title="ZUS i rezerwy">
        <Field label="Składka ZUS miesięczna (PLN)">
          <input
            inputMode="decimal"
            value={zusStr}
            onChange={(e) => setZusStr(e.target.value)}
            placeholder="0"
            className="input"
          />
          <div className="flex flex-wrap gap-1.5 mt-1">
            <ZusPreset label="Ulga" amount={defaultZusUlga} onPick={setZusStr} />
            <ZusPreset label="Mały" amount={defaultZusMaly} onPick={setZusStr} />
            <ZusPreset label="Pełny" amount={defaultZusPelny} onPick={setZusStr} />
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm text-zinc-700 select-none">
          <input
            type="checkbox"
            checked={includeVacation}
            onChange={(e) => setIncludeVacation(e.target.checked)}
          />
          <span>Wlicz rezerwę na urlop (26 dni × 8 h)</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 select-none">
          <input
            type="checkbox"
            checked={includeSick}
            onChange={(e) => setIncludeSick(e.target.checked)}
          />
          <span>Wlicz rezerwę na L4 (10 dni × 8 h)</span>
        </label>
      </Section>

      {withInvoice && (
        <Section title="Podatki (faktura)">
          <Field label="Sposób liczenia PIT">
            <div className="grid grid-cols-2 gap-2">
              <RadioCard
                checked={pitMode === "safe"}
                onChange={() => setPitMode("safe")}
                label="Bezpiecznie"
                hint={defaultTaxForm === "skala" ? "12% od 0 zł" : "19% od 0 zł"}
              />
              <RadioCard
                checked={pitMode === "scale"}
                onChange={() => setPitMode("scale")}
                label="Z kwotą wolną"
                hint={defaultTaxForm === "skala" ? "30k wolne, próg 120k" : "Liniowy bez kwoty wolnej"}
              />
            </div>
          </Field>
          {pitMode === "safe" ? (
            <Field label="PIT (% od dochodu)">
              <input
                inputMode="decimal"
                value={pitPctStr}
                onChange={(e) => setPitPctStr(e.target.value)}
                className="input"
              />
              <span className="text-[11px] text-zinc-500">
                Płaska stawka od pierwszej złotówki — najbezpieczniej dla cennika.
              </span>
            </Field>
          ) : (
            <Field label="Dochód roczny dotychczas (zł)">
              <input
                inputMode="decimal"
                value={yearIncomeStr}
                onChange={(e) => setYearIncomeStr(e.target.value)}
                placeholder="0"
                className="input"
              />
              <span className="text-[11px] text-zinc-500">
                {defaultTaxForm === "skala"
                  ? "Pierwsze 30 000 zł rocznego dochodu = 0% PIT, 30–120k = 12%, powyżej = 32%."
                  : "Liniowy 19% od pierwszej złotówki — kwota wolna nie obowiązuje."}
              </span>
            </Field>
          )}
          <Field label="VAT (%)">
            <input
              inputMode="decimal"
              value={vatPctStr}
              onChange={(e) => setVatPctStr(e.target.value)}
              className="input"
              disabled={!defaultIsVatPayer}
            />
            {!defaultIsVatPayer && (
              <span className="text-[11px] text-zinc-500">
                W ustawieniach masz „nie jestem płatnikiem VAT”.
              </span>
            )}
          </Field>
        </Section>
      )}

      <Section title="Dodatkowe koszty (opcjonalnie)">
        <p className="text-[11px] text-zinc-500 -mt-2">
          Materiały, paliwo, itp. Doliczone 1:1 do ceny dla klienta.
        </p>
        {extras.map((line, idx) => (
          <div key={line.id} className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              <input
                value={line.label}
                onChange={(e) =>
                  setExtras((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l))
                  )
                }
                placeholder="np. paliwo, materiał"
                className="input"
              />
            </div>
            <div className="w-28 shrink-0">
              <input
                inputMode="decimal"
                value={line.amountStr}
                onChange={(e) =>
                  setExtras((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, amountStr: e.target.value } : l))
                  )
                }
                placeholder="kwota"
                className="input text-right"
              />
            </div>
            <button
              type="button"
              onClick={() => setExtras((prev) => prev.filter((_, i) => i !== idx))}
              className="h-[42px] w-9 shrink-0 rounded-lg border border-zinc-200 text-zinc-500 active:bg-zinc-50"
              aria-label="Usuń"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setExtras((prev) => [...prev, makeLine()])}
          className="w-full rounded-lg border border-dashed border-zinc-300 text-sm py-2 text-zinc-600 active:bg-zinc-50"
        >
          + Dodaj pozycję
        </button>
      </Section>

      <Section title="Rozpis stawki">
        {empty ? (
          <p className="text-xs text-zinc-500">Wpisz liczbę godzin, żeby zobaczyć wyliczenie.</p>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            <Row
              label={`Stawka podstawowa (${rate.toFixed(2).replace(".", ",")} × ${hours.toFixed(
                hours % 1 === 0 ? 0 : 2
              )} h)`}
              value={result.baseAmount}
            />
            {includeVacation && (
              <Row
                label="Rezerwa urlop (26 dni × 8 h)"
                value={result.vacationAmount}
                muted
              />
            )}
            {includeSick && (
              <Row label="Rezerwa L4 (10 dni × 8 h)" value={result.sickAmount} muted />
            )}
            <Row
              label={`ZUS amortyzacja (${zusMonthly > 0 ? fmtPLN(zusMonthly) : "0 zł"} / 144 h prod.)`}
              value={result.zusAmount}
              muted
            />
            {result.extrasAmount > 0 && (
              <Row label="Materiały / dodatkowe" value={result.extrasAmount} muted />
            )}
            {withInvoice && (
              <>
                <Row
                  label={
                    pitMode === "safe"
                      ? `PIT ${pitPctStr}% (od dochodu, płaski)`
                      : `PIT (kwota wolna 30k + progi)`
                  }
                  value={result.pitAmount}
                  muted
                />
                <Row label="NETTO" value={result.netto} bold />
                <Row label={`VAT ${vatPctStr}%`} value={result.vatAmount} muted />
              </>
            )}
            <Row
              label={withInvoice ? "BRUTTO (do zapłaty)" : "RAZEM (do zapłaty)"}
              value={result.total}
              big
            />
            {result.recoveredVat > 0 && (
              <>
                <Row
                  label="+ VAT do odzyskania (z JPK)"
                  value={result.recoveredVat}
                  muted
                />
                <Row
                  label="Twój efektywny zysk"
                  value={result.effectiveProfit}
                  bold
                />
              </>
            )}
            {hours > 0 && (
              <Row
                label="Efektywna stawka /h dla klienta"
                value={result.rateEffectivePerH}
                muted
              />
            )}
          </div>
        )}
      </Section>

      <p className="text-[11px] text-zinc-500 text-center">
        Wyliczenie poglądowe. Skonsultuj z księgową.
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
        .input:disabled {
          background: #f4f4f5;
          color: #71717a;
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
        checked ? "border-accent bg-zinc-50" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-zinc-500">{hint}</div>
    </button>
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

function Row({
  label,
  value,
  muted,
  bold,
  big,
}: {
  label: string;
  value: number;
  muted?: boolean;
  bold?: boolean;
  big?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 px-3 py-2.5 ${
        big ? "bg-zinc-50" : ""
      }`}
    >
      <span className={`text-sm ${muted ? "text-zinc-500" : "text-zinc-800"}`}>{label}</span>
      <span
        className={`tabular-nums ${
          big ? "text-lg font-bold" : bold ? "text-base font-semibold" : "text-sm"
        }`}
      >
        {fmtPLN(value)}
      </span>
    </div>
  );
}
