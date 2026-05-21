"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type ProjectType,
} from "@/lib/dao/job_checklist.types";
import {
  getBriefSchema,
  type BriefField,
  type BriefSchema,
} from "@/lib/briefSchema";
import type { QuoteBrief } from "@/lib/dao/quote_briefs.types";
import KitchenLayoutDiagram from "./KitchenLayoutDiagram";
import WardrobeShapeDiagram from "./WardrobeShapeDiagram";
import BathroomLayoutDiagram from "./BathroomLayoutDiagram";
import SinkDiagram from "./SinkDiagram";
import UtilityLocationDiagram, {
  type UtilityDef,
} from "./UtilityLocationDiagram";

type Layout = "lin" | "l" | "u" | "wneka";
type WardrobeShape = "prosta" | "skos_trojkat" | "skos_kolankowy" | "skos_pionowy";

const KITCHEN_UTILITIES: UtilityDef[] = [
  { key: "plumbing", label: "Wodno-kan.", color: "#2563eb" },
  { key: "gas", label: "Gaz", color: "#f59e0b" },
  { key: "vent_chimney", label: "Komin went.", color: "#10b981" },
];

const BATHROOM_UTILITIES: UtilityDef[] = [
  { key: "plumbing", label: "Wodno-kan.", color: "#2563eb" },
  { key: "washer", label: "Pralka", color: "#ef4444" },
];

type Action = (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent w-full";

export default function BriefForm({
  action,
  initial,
  defaults,
  clientId,
  clientName,
  defaultProjectType,
  submitLabel,
}: {
  action: Action;
  initial?: QuoteBrief;
  defaults?: {
    title?: string;
    project_type?: ProjectType;
    visit_date?: string | null;
    notes?: string | null;
  };
  clientId: string;
  clientName: string;
  defaultProjectType?: ProjectType;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: undefined });
  const [projectType, setProjectType] = useState<ProjectType>(
    initial?.project_type ?? defaults?.project_type ?? defaultProjectType ?? "kitchen"
  );

  const schema: BriefSchema = getBriefSchema(projectType);
  const initialData = initial?.data ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="client_id" value={clientId} />

      <section className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
        <p className="text-xs text-zinc-500">Klient: <span className="font-medium text-zinc-800">{clientName}</span></p>

        <Field label="Typ projektu">
          <select
            name="project_type"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value as ProjectType)}
            className={inputCls}
          >
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>

        <Field label="Tytuł briefu">
          <input
            name="title"
            required
            defaultValue={initial?.title ?? defaults?.title ?? ""}
            placeholder={`np. Kuchnia — ul. Główna 12`}
            className={inputCls}
          />
        </Field>

        <Field label="Data pomiaru">
          <input
            type="date"
            name="visit_date"
            defaultValue={
              initial?.visit_date ??
              defaults?.visit_date ??
              new Date().toISOString().slice(0, 10)
            }
            className={inputCls}
          />
        </Field>

        <Field
          label="Wstępna wycena (PLN, brutto)"
          help="Opcjonalnie — przyjmie się jako kwota nowego zlecenia przy konwersji"
        >
          <input
            name="estimated_amount"
            inputMode="decimal"
            defaultValue={
              initial?.estimated_amount !== null && initial?.estimated_amount !== undefined
                ? String(initial.estimated_amount).replace(".", ",")
                : ""
            }
            placeholder="np. 18 500"
            className={inputCls}
          />
        </Field>
      </section>

      {schema.groups.map((group) => (
        <section key={group.title} className="rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-700 mb-3">{group.title}</h3>
          <div className="flex flex-col gap-3">
            {group.fields.map((f) => {
              if (projectType === "kitchen" && f.key === "window_wall") {
                const layoutRaw = initialData["room_layout"];
                const layout: Layout =
                  layoutRaw === "lin" || layoutRaw === "l" || layoutRaw === "u" || layoutRaw === "wneka"
                    ? layoutRaw
                    : "u";
                const wwRaw = initialData["window_wall"];
                const ww = typeof wwRaw === "string" ? wwRaw : "";
                const islandRaw = initialData["has_island"];
                const island = islandRaw === true || islandRaw === "true" || islandRaw === "on";
                return (
                  <KitchenLayoutDiagram
                    key={f.key}
                    initialLayout={layout}
                    initialWindowWall={ww}
                    initialHasIsland={island}
                  />
                );
              }
              if (projectType === "wardrobe" && f.key === "room_shape") {
                const shapeRaw = initialData["room_shape"];
                const shape: WardrobeShape =
                  shapeRaw === "prosta" ||
                  shapeRaw === "skos_trojkat" ||
                  shapeRaw === "skos_kolankowy" ||
                  shapeRaw === "skos_pionowy"
                    ? shapeRaw
                    : "prosta";
                return (
                  <div key={f.key} className="flex flex-col gap-3">
                    <FieldRender field={f} initialValue={initialData[f.key]} />
                    <WardrobeShapeDiagram initialShape={shape} />
                  </div>
                );
              }
              if (projectType === "bathroom" && f.key === "room_layout") {
                const layoutRaw = initialData["room_layout"];
                const layout: Layout =
                  layoutRaw === "lin" ||
                  layoutRaw === "l" ||
                  layoutRaw === "u" ||
                  layoutRaw === "wneka"
                    ? layoutRaw
                    : "lin";
                return (
                  <div key={f.key} className="flex flex-col gap-3">
                    <FieldRender field={f} initialValue={initialData[f.key]} />
                    <BathroomLayoutDiagram initialLayout={layout} />
                  </div>
                );
              }
              if (projectType === "bathroom" && f.key === "sink_width_mm") {
                return (
                  <div key={f.key} className="flex flex-col gap-3">
                    <FieldRender field={f} initialValue={initialData[f.key]} />
                    <SinkDiagram />
                  </div>
                );
              }
              if (
                (projectType === "kitchen" || projectType === "bathroom") &&
                f.key === "plumbing_wall"
              ) {
                const utils =
                  projectType === "kitchen"
                    ? KITCHEN_UTILITIES
                    : BATHROOM_UTILITIES;
                return (
                  <div key={f.key} className="flex flex-col gap-3">
                    <UtilityLocationDiagram utilities={utils} />
                    <FieldRender field={f} initialValue={initialData[f.key]} />
                  </div>
                );
              }
              return (
                <FieldRender
                  key={f.key}
                  field={f}
                  initialValue={initialData[f.key]}
                />
              );
            })}
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <Field label="Notatki ogólne (widoczne na podsumowaniu)">
          <textarea
            name="notes"
            rows={3}
            defaultValue={initial?.notes ?? defaults?.notes ?? ""}
            className={inputCls}
          />
        </Field>
      </section>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-white py-3 font-medium disabled:opacity-50"
      >
        {pending ? "Zapisuję..." : submitLabel ?? (initial ? "Zapisz zmiany" : "Utwórz brief")}
      </button>
    </form>
  );
}

function FieldRender({
  field,
  initialValue: rawInitialValue,
}: {
  field: BriefField;
  initialValue: string | number | boolean | number[] | null | undefined;
}) {
  const name = `data.${field.key}`;
  const initialValue = Array.isArray(rawInitialValue) ? undefined : rawInitialValue;
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          name={name}
          defaultChecked={Boolean(initialValue)}
          className="size-4"
        />
        <span>{field.label}</span>
      </label>
    );
  }
  if (field.type === "radio") {
    return (
      <Field label={field.label}>
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => (
            <label
              key={o.value}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm cursor-pointer has-[:checked]:bg-accent has-[:checked]:text-white has-[:checked]:border-accent"
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                defaultChecked={initialValue === o.value}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </Field>
    );
  }
  if (field.type === "select") {
    return (
      <Field label={field.label}>
        <select
          name={name}
          defaultValue={typeof initialValue === "string" ? initialValue : ""}
          className={inputCls}
        >
          <option value="">— wybierz —</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
    );
  }
  if (field.type === "textarea") {
    return (
      <Field label={field.label} help={field.help}>
        <textarea
          name={name}
          rows={3}
          defaultValue={typeof initialValue === "string" ? initialValue : ""}
          placeholder={field.placeholder}
          className={inputCls}
        />
      </Field>
    );
  }
  // text / number
  return (
    <Field label={field.label + (field.unit ? ` (${field.unit})` : "")} help={field.help}>
      <input
        name={name}
        inputMode={field.type === "number" ? "decimal" : undefined}
        defaultValue={
          initialValue === null || initialValue === undefined || typeof initialValue === "boolean"
            ? ""
            : String(initialValue)
        }
        placeholder={field.placeholder}
        className={inputCls}
      />
    </Field>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-zinc-700">{label}</span>
      {children}
      {help && <span className="text-[11px] text-zinc-500">{help}</span>}
    </label>
  );
}
