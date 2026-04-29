"use client";

import { useActionState, useState } from "react";
import type { TaxForm } from "@/lib/tax";
import type { VatPeriod } from "@/lib/dao/user_settings.types";

type Action = (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;

export type SettingsInitial = {
  business_name: string | null;
  business_nip: string | null;
  tax_form: TaxForm;
  vat_period: VatPeriod;
  is_vat_payer: boolean;
  default_vat_rate: number;
  zus_monthly: number | null;
};

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
  const [state, formAction, pending] = useActionState(action, { error: undefined });

  const vatPctDefault = (initial.default_vat_rate * 100).toFixed(0);
  const zusDefault = initial.zus_monthly != null ? String(initial.zus_monthly) : "";

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
            className="h-5 w-5 accent-[#282624]"
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
        <Field label="Składka ZUS miesięcznie (PLN)">
          <input
            name="zus_monthly"
            inputMode="decimal"
            defaultValue={zusDefault}
            placeholder="0"
            className={inputCls}
          />
        </Field>
      </Section>

      {state.error && <p className={errorCls}>{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#282624] text-white py-3 font-medium active:opacity-80 disabled:opacity-50"
      >
        {pending ? "Zapisuję..." : "Zapisz ustawienia"}
      </button>
    </form>
  );
}

const inputCls =
  "rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-3 text-base focus:outline-none focus:border-[#282624] w-full";
const errorCls = "text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
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
      <span className="text-xs font-medium text-zinc-600">{label}</span>
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
      className={`flex-1 text-center text-sm py-2 rounded-md cursor-pointer ${
        active ? "bg-white shadow-sm font-medium" : "text-zinc-600"
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
