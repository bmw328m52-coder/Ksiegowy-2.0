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
  type BriefField,
  type BriefSchema,
} from "@/lib/briefSchema";
import type { QuoteBrief } from "@/lib/dao/quote_briefs.types";
import type { UtilityDef } from "./UtilityLocationDiagram";

const OFFSET_LABEL = "Odległość od lewego narożnika ściany";
const HEIGHT_LABEL = "Wysokość od podłogi";
const WIDTH_LABEL = "Szerokość zajmowanego pola";
const OCCUPIED_HEIGHT_LABEL = "Wysokość zajmowanego pola";
import CorpusListInput from "./CorpusListInput";
import HingesBreakdownInput from "./HingesBreakdownInput";
import LiftBreakdownInput from "./LiftBreakdownInput";

const KitchenLayoutDiagram = dynamic(() => import("./KitchenLayoutDiagram"), {
  ssr: false,
  loading: () => <DiagramSkeleton />,
});
const WardrobeShapeDiagram = dynamic(() => import("./WardrobeShapeDiagram"), {
  ssr: false,
  loading: () => <DiagramSkeleton />,
});
const BathroomLayoutDiagram = dynamic(() => import("./BathroomLayoutDiagram"), {
  ssr: false,
  loading: () => <DiagramSkeleton />,
});
const SinkDiagram = dynamic(() => import("./SinkDiagram"), {
  ssr: false,
  loading: () => <DiagramSkeleton />,
});
const UtilityLocationDiagram = dynamic(() => import("./UtilityLocationDiagram"), {
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

type Layout = "lin" | "l" | "u" | "wneka" | "kwadrat" | "kwadrat_pol";
type WardrobeShape = "prosta" | "skos_trojkat" | "skos_kolankowy" | "skos_pionowy";

const KITCHEN_UTILITIES: UtilityDef[] = [
  {
    key: "plumbing",
    label: "Wodno-kan.",
    color: "#2563eb",
    fields: [
      { key: "plumbing_offset_mm", label: OFFSET_LABEL, role: "offset" },
      {
        key: "plumbing_height_mm",
        label: HEIGHT_LABEL,
        role: "height",
        help: "wysokość środka pola przyłączy",
      },
      { key: "plumbing_width_mm", label: WIDTH_LABEL, role: "width" },
      {
        key: "plumbing_occupied_height_mm",
        label: OCCUPIED_HEIGHT_LABEL,
        role: "occupied_height",
      },
    ],
  },
  {
    key: "gas",
    label: "Gaz",
    color: "#f59e0b",
    fields: [
      { key: "gas_offset_mm", label: OFFSET_LABEL, role: "offset" },
      { key: "gas_height_mm", label: HEIGHT_LABEL, role: "height" },
    ],
  },
  {
    key: "vent_chimney",
    label: "Komin went.",
    color: "#10b981",
    fields: [
      { key: "vent_chimney_offset_mm", label: OFFSET_LABEL, role: "offset" },
      {
        key: "vent_chimney_height_mm",
        label: "Wysokość wlotu od podłogi",
        role: "height",
      },
      { key: "vent_chimney_width_mm", label: WIDTH_LABEL, role: "width" },
      {
        key: "vent_chimney_occupied_height_mm",
        label: OCCUPIED_HEIGHT_LABEL,
        role: "occupied_height",
      },
      {
        key: "vent_chimney_depth_mm",
        label: "Głębokość wystawania ze ściany",
        role: "extra",
        help: "0 = w licu ściany; >0 = występ",
      },
    ],
  },
];

const BATHROOM_UTILITIES: UtilityDef[] = [
  {
    key: "plumbing",
    label: "Wodno-kan.",
    color: "#2563eb",
    fields: [
      { key: "plumbing_offset_mm", label: OFFSET_LABEL, role: "offset" },
      { key: "plumbing_height_mm", label: HEIGHT_LABEL, role: "height" },
      { key: "plumbing_width_mm", label: WIDTH_LABEL, role: "width" },
      {
        key: "plumbing_occupied_height_mm",
        label: OCCUPIED_HEIGHT_LABEL,
        role: "occupied_height",
      },
    ],
  },
  {
    key: "washer",
    label: "Pralka",
    color: "#ef4444",
    fields: [
      { key: "washer_offset_mm", label: OFFSET_LABEL, role: "offset" },
      { key: "washer_height_mm", label: HEIGHT_LABEL, role: "height" },
    ],
  },
];

function buildDiagramFieldSet(utils: UtilityDef[]): Set<string> {
  const s = new Set<string>();
  for (const u of utils) for (const f of u.fields) s.add(f.key);
  return s;
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
  const isAfterMeasure = openPostByDefault;
  const [state, formAction, pending] = useActionState(action ?? NOOP_ACTION, { error: undefined });
  const [projectType, setProjectType] = useState<ProjectType>(
    initial?.project_type ?? defaults?.project_type ?? defaultProjectType ?? "kitchen"
  );

  const schema: BriefSchema = getBriefSchema(projectType);
  const initialData = initial?.data ?? {};

  const diagramUtilities: UtilityDef[] | null =
    projectType === "kitchen"
      ? KITCHEN_UTILITIES
      : projectType === "bathroom"
        ? BATHROOM_UTILITIES
        : null;
  const diagramFieldSet = diagramUtilities
    ? buildDiagramFieldSet(diagramUtilities)
    : null;

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
          if (projectType === "kitchen" && f.key === "window_wall") {
            const layoutRaw = initialData["room_layout"];
            const layout: Layout =
              layoutRaw === "lin" ||
              layoutRaw === "l" ||
              layoutRaw === "u" ||
              layoutRaw === "wneka" ||
              layoutRaw === "kwadrat" ||
              layoutRaw === "kwadrat_pol"
                ? layoutRaw
                : "u";
            const wwRaw = initialData["window_wall"];
            const ww = typeof wwRaw === "string" ? wwRaw : "";
            const islandRaw = initialData["has_island"];
            const island = islandRaw === true || islandRaw === "true" || islandRaw === "on";
            const rotRaw = initialData["island_rotation"];
            const rot: 0 | 90 = rotRaw === "90" || rotRaw === 90 ? 90 : 0;
            return (
              <KitchenLayoutDiagram
                key={f.key}
                initialLayout={layout}
                initialWindowWall={ww}
                initialHasIsland={island}
                initialIslandRotation={rot}
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
          if (diagramUtilities && f.key === "plumbing_wall") {
            return (
              <div key={f.key} className="flex flex-col gap-3">
                <UtilityLocationDiagram
                  utilities={diagramUtilities}
                  initialData={initialData}
                />
                <FieldRender field={f} initialValue={initialData[f.key]} />
              </div>
            );
          }
          if (diagramFieldSet?.has(f.key)) {
            return null;
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

        return (
          <>
            {schema.groups.map((group) => {
              const measurementFields = group.fields.filter((f) => !isPost(f));
              if (measurementFields.length === 0) return null;
              return (
                <section key={group.title} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">{group.title}</h3>
                  <div className="flex flex-col gap-3">
                    {measurementFields.map(renderFieldNode)}
                  </div>
                </section>
              );
            })}

            {hasPostFields && (
              <section id="uzupelnienie" className="rounded-xl border border-zinc-200 bg-white p-4 scroll-mt-4">
                <details className="group" open={isAfterMeasure}>
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-zinc-700">
                        Uzupełnienie do wyceny (po pomiarze)
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        Pola ilościowe i szczegóły — wypełnij po akceptacji wstępnej wyceny
                      </span>
                    </div>
                    <span className="text-zinc-400 text-xs group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <div className="flex flex-col gap-5 mt-4">
                    {postGroups.map((g) => (
                      <div key={g.title} className="flex flex-col gap-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          {g.title}
                        </h4>
                        <div className="flex flex-col gap-3">
                          {g.fields.map(renderFieldNode)}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </section>
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
