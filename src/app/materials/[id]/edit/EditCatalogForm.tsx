"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import type { MaterialCatalogItem } from "@/lib/dao/material_catalog";
import { UNITS, isUnit } from "@/lib/units";

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent w-full";

type Action = (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;

export default function EditCatalogForm({
  action,
  initial,
}: {
  action: Action;
  initial: MaterialCatalogItem;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string }, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result.error) router.push("/materials");
      return result;
    },
    { error: undefined }
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Nazwa" required>
        <input name="name" required defaultValue={initial.name} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jednostka">
          <select name="unit" defaultValue={initial.unit} className={inputCls}>
            {initial.unit && !isUnit(initial.unit) && (
              <option value={initial.unit}>{initial.unit} (obecna)</option>
            )}
            {UNITS.map((u) => (
              <option key={u.code} value={u.code}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cena brutto (PLN)">
          <input
            name="default_price_gross"
            inputMode="decimal"
            defaultValue={initial.default_price_gross ?? ""}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Kategoria">
        <input name="category" defaultValue={initial.category ?? ""} className={inputCls} />
      </Field>
      <Field label="Notatka">
        <input name="notes" defaultValue={initial.notes ?? ""} className={inputCls} />
      </Field>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-white py-3 font-medium disabled:opacity-50"
      >
        {pending ? "Zapisuję..." : "Zapisz zmiany"}
      </button>
    </form>
  );
}

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
