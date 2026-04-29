"use client";

import { useActionState, useState } from "react";
import type { Client, ClientType } from "@/lib/dao/clients.types";

type Action = (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;

export default function ClientForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: Partial<Client>;
  submitLabel: string;
}) {
  const [type, setType] = useState<ClientType>((initial?.type as ClientType) ?? "company");
  const [state, formAction, pending] = useActionState(action, { error: undefined });

  return (
    <form action={formAction} className="w-full flex flex-col gap-4">
      <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
        <RadioPill name="type" value="company" label="Firma" current={type} onChange={setType} />
        <RadioPill name="type" value="individual" label="Osoba prywatna" current={type} onChange={setType} />
      </div>

      <Field label={type === "company" ? "Nazwa firmy" : "Imię i nazwisko"} required>
        <input name="name" required defaultValue={initial?.name ?? ""} className={inputCls} />
      </Field>

      {type === "company" && (
        <Field label="NIP">
          <input name="nip" inputMode="numeric" defaultValue={initial?.nip ?? ""} className={inputCls} />
        </Field>
      )}

      <Field label="Adres">
        <input name="address" defaultValue={initial?.address ?? ""} className={inputCls} />
      </Field>

      <Field label="E-mail">
        <input name="email" type="email" inputMode="email" defaultValue={initial?.email ?? ""} className={inputCls} />
      </Field>

      <Field label="Telefon">
        <input name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone ?? ""} className={inputCls} />
      </Field>

      <Field label="Notatki">
        <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} className={inputCls} />
      </Field>

      {state.error && <p className={errorCls}>{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#282624] text-white py-3 font-medium active:opacity-80 disabled:opacity-50"
      >
        {pending ? "Zapisuję..." : submitLabel}
      </button>
    </form>
  );
}

const inputCls =
  "rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-3 text-base focus:outline-none focus:border-[#282624] w-full";
const errorCls = "text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function RadioPill({
  name,
  value,
  label,
  current,
  onChange,
}: {
  name: string;
  value: ClientType;
  label: string;
  current: ClientType;
  onChange: (v: ClientType) => void;
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
