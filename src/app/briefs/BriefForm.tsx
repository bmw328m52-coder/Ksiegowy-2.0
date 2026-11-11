"use client";

import { useActionState, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type ProjectType,
} from "@/lib/dao/job_checklist.types";
import {
  getBriefSchema,
  SCAN_FIELDS,
  type BriefField,
  type BriefSchema,
} from "@/lib/briefSchema";
import type { QuoteBrief } from "@/lib/dao/quote_briefs.types";
import CorpusListInput from "./CorpusListInput";
import HingesBreakdownInput from "./HingesBreakdownInput";
import LiftBreakdownInput from "./LiftBreakdownInput";

const SinkDiagram = dynamic(() => import("./SinkDiagram"), {
  ssr: false,
  loading: () => <DiagramSkeleton />,
});
function DiagramSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-400">
      Ładowanie diagramu…
    </div>
  );
}

type Action = (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent w-full";

const NOOP_ACTION: Action = async () => ({ error: undefined });

export default function BriefForm({
  action,
  initial,
  defaults,
  clientId,
  clientName,
  defaultProjectType,
  submitLabel,
  openPostByDefault = false,
}: {
  action?: Action;
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
  openPostByDefault?: boolean;
}) {
  const [tab, setTab] = useState<"measurement" | "post">(
    openPostByDefault ? "post" : "measurement"
  );
  const [state, formAction, pending] = useActionState(action ?? NOOP_ACTION, { error: undefined });
  const [projectType, setProjectType] = useState<ProjectType>(
    initial?.project_type ?? defaults?.project_type ?? defaultProjectType ?? "kitchen"
  );

  const schema: BriefSchema = getBriefSchema(projectType);
  const initialData = initial?.data ?? {};

  // Geometrię pomieszczenia zbiera skaner na iPadzie — formularz to same wybory.
  const scanKeys = SCAN_FIELDS[projectType];
  const isFromScan = (f: BriefField) => scanKeys?.has(f.key) === true;

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

      {(() => {
        const renderFieldNode = (f: BriefField): ReactNode => {
          if (projectType === "bathroom" && f.key === "sink_width_mm") {
            return (
              <div key={f.key} className="flex flex-col gap-3">
                <FieldRender field={f} initialValue={initialData[f.key]} />
                <SinkDiagram />
              </div>
            );
          }
          if (projectType === "kitchen" && f.key === "corpus_list") {
            const listRaw = initialData["corpus_list"];
            const fallbackRaw = initialData["corpus_color"];
            return (
              <CorpusListInput
                key={f.key}
                initialJson={typeof listRaw === "string" ? listRaw : undefined}
                fallbackColor={typeof fallbackRaw === "string" ? fallbackRaw : undefined}
              />
            );
          }
          if (f.key === "hinges_breakdown") {
            const raw = initialData["hinges_breakdown"];
            return (
              <HingesBreakdownInput
                key={f.key}
                initialJson={typeof raw === "string" ? raw : undefined}
              />
            );
          }
          if (f.key === "lift_breakdown") {
            const raw = initialData["lift_breakdown"];
            return (
              <LiftBreakdownInput
                key={f.key}
                initialJson={typeof raw === "string" ? raw : undefined}
              />
            );
          }
          return (
            <FieldRender
              key={f.key}
              field={f}
              initialValue={initialData[f.key]}
            />
          );
        };

        const isPost = (f: BriefField) => f.stage === "post_measurement";
        const postGroups = schema.groups
          .map((g) => ({ title: g.title, fields: g.fields.filter(isPost) }))
          .filter((g) => g.fields.length > 0);
        const hasPostFields = postGroups.length > 0;
        const postFieldCount = postGroups.reduce((n, g) => n + g.fields.length, 0);
        // Gdy typ projektu nie ma pól po-pomiarowych, pokazujemy tylko pomiar
        // (bez paska zakładek), żeby stan tab="post" nie ukrył formularza.
        const showMeasurement = tab === "measurement" || !hasPostFields;

        return (
          <>
            {hasPostFields && (
              <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
                <TabButton active={showMeasurement} onClick={() => setTab("measurement")}>
                  Pomiar
                </TabButton>
                <TabButton active={tab === "post"} onClick={() => setTab("post")}>
                  Po pomiarze
                  <span className="ml-1.5 rounded-full bg-black/10 px-1.5 text-[10px] tabular-nums">
                    {postFieldCount}
                  </span>
                </TabButton>
              </div>
            )}

            {/* Panel: Pomiar — tylko dane zbierane na wizycie */}
            <div className={showMeasurement ? "flex flex-col gap-5" : "hidden"}>
              <p className="rounded-xl border border-[#cfe4d4] bg-[#eef6f0] px-3.5 py-2.5 text-xs text-[#3a6b4d]">
                Wymiary ścian, okna i położenie przyłączy zbiera skaner na iPadzie — tu zostają tylko wybory.
              </p>
              {schema.groups.map((group) => {
                const measurementFields = group.fields.filter((f) => !isPost(f));
                if (measurementFields.length === 0) return null;
                const visible = measurementFields.filter((f) => !isFromScan(f));
                const hidden = measurementFields.filter(isFromScan);
                const hiddenInputs = hidden.map((f) => (
                  <HiddenField key={f.key} field={f} value={initialData[f.key]} />
                ));
                if (visible.length === 0) return <div key={group.title}>{hiddenInputs}</div>;
                return (
                  <section key={group.title} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-zinc-700 mb-3">{group.title}</h3>
                    <div className="flex flex-col gap-3">
                      {visible.map(renderFieldNode)}
                      {hiddenInputs}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Panel: Po pomiarze — pola ilościowe po akceptacji wyceny.
                Zostaje w DOM nawet gdy ukryty, żeby wszystkie pola wysłały się
                jednym submitem. id zachowane dla CTA #uzupelnienie. */}
            {hasPostFields && (
              <div
                id="uzupelnienie"
                className={tab === "post" ? "flex flex-col gap-5 scroll-mt-4" : "hidden"}
              >
                <p className="text-[11px] text-zinc-500 -mb-1">
                  Pola ilościowe i szczegóły — wypełnij po akceptacji wstępnej wyceny.
                </p>
                {postGroups.map((g) => (
                  <section key={g.title} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-zinc-700 mb-3">{g.title}</h3>
                    <div className="flex flex-col gap-3">
                      {g.fields.map(renderFieldNode)}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        );
      })()}

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

/** Pole geometrii — niewidoczne, ale zachowuje wartość wpisaną dawniej ręcznie. */
function HiddenField({
  field,
  value,
}: {
  field: BriefField;
  value: string | number | boolean | number[] | null | undefined;
}) {
  if (value === undefined || value === null || value === "" || value === false) return null;
  const v = field.type === "checkbox" ? "on" : Array.isArray(value) ? value.join(",") : String(value);
  return <input type="hidden" name={`data.${field.key}`} value={v} />;
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-white text-zinc-900 shadow-sm"
          : "text-zinc-500 active:bg-white/50"
      }`}
    >
      {children}
    </button>
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
