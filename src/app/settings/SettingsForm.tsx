"use client";

import { useActionState, useState } from "react";
import type { TaxForm } from "@/lib/tax";
import type { VatPeriod } from "@/lib/dao/user_settings.types";
import {
  zusPhaseForMonth,
  zusPhaseBoundaries,
  zusSocialForPhase,
  ZUS_PHASE_LABELS,
  HEALTH_RATE_SKALA,
  HEALTH_RATE_LINIOWY,
} from "@/lib/zus";

type Action = (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;

export type SettingsInitial = {
  business_name: string | null;
  business_nip: string | null;
  tax_form: TaxForm;
  vat_period: VatPeriod;
  is_vat_payer: boolean;
  default_vat_rate: number;
  zus_monthly: number | null;
  zus_start_date: string | null;
  zus_ulga: number | null;
  zus_maly: number | null;
  zus_pelny: number | null;
  health_insurance_min: number | null;
  default_hourly_rate: number | null;
};

const MONTHS_PL = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];

const zl = (n: number) =>
  n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";

export default function SettingsForm({
  action,
  initial,
}: {
  action: Action;
  initial: SettingsInitial;
}) {
  const [taxForm, setTaxForm] = useState<TaxForm>(initial.tax_form);
  const [vatPeriod, setVatPeriod] = useState<VatPeriod>(initial.vat_period);
  const [isVatPayer, setIsVatPayer] = useState<boolean>(initial.is_vat_payer);
  const [startDate, setStartDate] = useState<string>(initial.zus_start_date ?? "");
  const [state, formAction, pending] = useActionState(action, { error: undefined });

  const vatPctDefault = (initial.default_vat_rate * 100).toFixed(0);
  const zusDefault = initial.zus_monthly != null ? String(initial.zus_monthly) : "";
  const hourlyDefault = initial.default_hourly_rate != null ? String(initial.default_hourly_rate) : "50";
  const healthMinDefault =
    initial.health_insurance_min != null ? String(initial.health_insurance_min) : "432.54";

  const now = new Date();
  const phase = startDate
    ? zusPhaseForMonth(startDate, now.getFullYear(), now.getMonth())
    : null;
  const boundaries = startDate ? zusPhaseBoundaries(startDate) : null;
  const healthMinNum = Number(String(healthMinDefault).replace(",", ".")) || 432.54;
  const social = phase ? zusSocialForPhase(phase) : 0;
  const healthRatePct = taxForm === "liniowy" ? HEALTH_RATE_LINIOWY : HEALTH_RATE_SKALA;
  const monthLabel = (b: { year: number; monthIdx: number }) =>
    `${MONTHS_PL[b.monthIdx]} ${b.year}`;

  return (
    <form action={formAction} className="w-full flex flex-col gap-5">
      <Section title="Firma">
        <Field label="Nazwa firmy">
          <input
            name="business_name"
            defaultValue={initial.business_name ?? ""}
            placeholder="LUVIANO"
            className={inputCls}
          />
        </Field>
        <Field label="NIP">
          <input
            name="business_nip"
            inputMode="numeric"
            defaultValue={initial.business_nip ?? ""}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Forma opodatkowania">
        <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
          <Pill name="tax_form" value="skala" label="Skala 12% / 32%" current={taxForm} onChange={setTaxForm} />
          <Pill name="tax_form" value="liniowy" label="Liniowy 19%" current={taxForm} onChange={setTaxForm} />
        </div>
      </Section>

      <Section title="VAT">
        <label className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm">Jestem płatnikiem VAT</span>
          <input
            type="checkbox"
            name="is_vat_payer"
            checked={isVatPayer}
            onChange={(e) => setIsVatPayer(e.target.checked)}
            className="h-5 w-5 accent-[var(--accent)]"
          />
        </label>

        {isVatPayer && (
          <>
            <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
              <Pill name="vat_period" value="monthly" label="Miesięczny" current={vatPeriod} onChange={setVatPeriod} />
              <Pill name="vat_period" value="quarterly" label="Kwartalny" current={vatPeriod} onChange={setVatPeriod} />
            </div>

            <Field label="Domyślna stawka VAT (%)">
              <input
                name="default_vat_rate"
                inputMode="decimal"
                defaultValue={vatPctDefault}
                className={inputCls}
              />
            </Field>
          </>
        )}
        {!isVatPayer && (
          <>
            <input type="hidden" name="vat_period" value={vatPeriod} />
            <input type="hidden" name="default_vat_rate" value={vatPctDefault} />
          </>
        )}
      </Section>

      <Section title="ZUS">
        <Field label="Data rozpoczęcia działalności">
          <input
            type="date"
            name="zus_start_date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputCls}
          />
        </Field>
        <p className="text-[13px] text-[var(--muted)] -mt-1">
          Na tej podstawie aplikacja sama wylicza fazę: ulga na start (6 mies.) → preferencyjny (24 mies.) → pełny ZUS.
        </p>

        {phase && boundaries && (
          <div className="rounded-lg border border-[#ededea] bg-[var(--surface-2)] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[var(--muted)]">Bieżący miesiąc</span>
              <span className="text-sm font-semibold text-[#a06f3f]">
                {ZUS_PHASE_LABELS[phase]}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">Składki społeczne</span>
              <span className="font-medium text-[#1f1d1b]">{zl(social)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">
                Zdrowotna ({(healthRatePct * 100).toLocaleString("pl-PL")}% dochodu)
              </span>
              <span className="font-medium text-[#1f1d1b]">min {zl(healthMinNum)}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-[#ededea] pt-2">
              <span className="font-medium text-zinc-700">Do zapłaty (minimum)</span>
              <span className="font-semibold text-[#1f1d1b]">{zl(social + healthMinNum)}</span>
            </div>
            <p className="text-[12px] text-[var(--muted)]">
              Zdrowotna rośnie z dochodem — dokładną kwotę za dany miesiąc pokazuje pulpit.
            </p>

            <div className="text-[12px] text-[var(--muted)] border-t border-[#ededea] pt-2 leading-relaxed">
              <div>Ulga na start do: <b>{monthLabel(boundaries.ulgaLastMonth)}</b></div>
              <div>Preferencyjny do: <b>{monthLabel(boundaries.prefLastMonth)}</b></div>
              <div>Pełny ZUS od: <b>{monthLabel(boundaries.fullFirstMonth)}</b></div>
            </div>
          </div>
        )}

        <Field label="Minimalna składka zdrowotna (PLN/mies.)">
          <input
            name="health_insurance_min"
            inputMode="decimal"
            defaultValue={healthMinDefault}
            placeholder="432,54"
            className={inputCls}
          />
        </Field>
        <p className="text-[13px] text-[var(--muted)] -mt-1">
          Minimum zdrowotnej (2026: 432,54 zł). Powyżej minimum liczone jako {(healthRatePct * 100).toLocaleString("pl-PL")}% dochodu.
        </p>

        {!startDate && (
          <Field label="albo: stała składka ZUS miesięcznie (PLN)">
            <input
              name="zus_monthly"
              inputMode="decimal"
              defaultValue={zusDefault}
              placeholder="0"
              className={inputCls}
            />
          </Field>
        )}
        {startDate && <input type="hidden" name="zus_monthly" value={zusDefault} />}

        {/* Presety ZUS dla kalkulatora wyceny — zachowaj bieżące wartości. */}
        <input type="hidden" name="zus_ulga" value={initial.zus_ulga ?? 397.16} />
        <input type="hidden" name="zus_maly" value={initial.zus_maly ?? 891.34} />
        <input type="hidden" name="zus_pelny" value={initial.zus_pelny ?? 1900} />
      </Section>

      <Section title="Stawka godzinowa">
        <Field label="Stawka „na rękę” (PLN/h)">
          <input
            name="default_hourly_rate"
            inputMode="decimal"
            defaultValue={hourlyDefault}
            placeholder="50"
            className={inputCls}
          />
        </Field>
        <p className="text-[13px] text-[var(--muted)]">
          Ile chcesz zarabiać netto za 1 h pracy. Używana w kalkulatorze stawki za usługę.
        </p>
      </Section>

      {state.error && <p role="alert" className={errorCls}>{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--accent)] text-[var(--btn-fg)] min-h-12 py-3 text-base font-semibold active:opacity-80 disabled:opacity-50"
      >
        {pending ? "Zapisuję..." : "Zapisz ustawienia"}
      </button>
    </form>
  );
}

const inputCls =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] px-3 min-h-12 py-3 text-base focus:outline-none focus:border-[var(--accent)] w-full";
const errorCls = "text-sm text-[var(--warn)] bg-[var(--warn-soft)] border border-[var(--warn)] rounded-md px-3 py-2";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--accent)]">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function Pill<T extends string>({
  name,
  value,
  label,
  current,
  onChange,
}: {
  name: string;
  value: T;
  label: string;
  current: T;
  onChange: (v: T) => void;
}) {
  const active = current === value;
  return (
    <label
      className={`flex-1 text-center text-[15px] min-h-11 flex items-center justify-center rounded-md cursor-pointer ${
        active ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[#97814f] font-semibold" : "text-[var(--muted)]"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={active}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
