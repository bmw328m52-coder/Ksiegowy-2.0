import Link from "next/link";
import type { QuoteBrief } from "@/lib/dao/quote_briefs";
import type { BriefData } from "@/lib/dao/quote_briefs.types";
import { getBriefSchema, type BriefField } from "@/lib/briefSchema";
import { PROJECT_TYPE_LABELS } from "@/lib/dao/job_checklist.types";
import { fmtDate } from "@/lib/format";
import RoomMiniDiagram from "./RoomMiniDiagram";

const ROOM_DIAGRAM_KEYS = new Set([
  "wall_a_mm",
  "wall_b_mm",
  "wall_c_mm",
  "wall_d_mm",
  "room_layout",
  "room_rotation",
  "room_mirror",
  "window_wall",
]);

export default function PomiarSection({
  jobId,
  brief,
  projectType,
}: {
  jobId: string;
  brief: QuoteBrief | null;
  projectType: QuoteBrief["project_type"] | null;
}) {
  if (!brief) {
    return (
      <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-700">Pomiar</h2>
        <p className="text-xs text-zinc-500">
          Brak danych pomiaru. Wypełnij wymiary, kolory, AGD, LED-y itd.
        </p>
        <Link
          href={`/jobs/${jobId}/pomiar/edit`}
          className="rounded-md bg-accent text-white py-2 text-sm font-medium text-center"
        >
          + Wypełnij pomiar
        </Link>
      </section>
    );
  }

  const schema = getBriefSchema(brief.project_type);
  const data = brief.data;

  const filledGroups = schema.groups
    .map((g) => ({
      title: g.title,
      rows: g.fields
        .map((f) => ({ field: f, value: data[f.key] }))
        .filter((r) =>
          r.field.type === "checkbox"
            ? r.value === true
            : r.value !== undefined && r.value !== null && r.value !== ""
        ),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-700">Pomiar</h2>
        <Link
          href={`/jobs/${jobId}/pomiar/edit`}
          className="text-xs text-zinc-600 underline-offset-2 hover:underline"
        >
          Edytuj
        </Link>
      </div>

      <div className="text-xs text-zinc-500 flex flex-wrap gap-x-3 gap-y-1">
        <span>Typ: <span className="text-zinc-800 font-medium">{PROJECT_TYPE_LABELS[brief.project_type]}</span></span>
        {brief.visit_date && (
          <span>
            Data:{" "}
            <span className="text-zinc-800 font-medium">
              {fmtDate(brief.visit_date)}
              {typeof data.visit_time === "string" && data.visit_time
                ? `, ${data.visit_time}`
                : ""}
            </span>
          </span>
        )}
      </div>

      {(typeof data.visit_address === "string" && data.visit_address) ||
      (typeof data.visit_phone === "string" && data.visit_phone) ? (
        <div className="rounded-lg bg-[#faf7f2] border border-[#e6dcc7] px-3 py-2 text-xs flex flex-col gap-1">
          {typeof data.visit_address === "string" && data.visit_address && (
            <div className="flex items-baseline gap-2">
              <span className="text-zinc-500 shrink-0">Adres:</span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  String(data.visit_address)
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#7d5530] font-medium underline-offset-2 hover:underline break-words"
              >
                {String(data.visit_address)}
              </a>
            </div>
          )}
          {typeof data.visit_phone === "string" && data.visit_phone && (
            <div className="flex items-baseline gap-2">
              <span className="text-zinc-500 shrink-0">Telefon:</span>
              <a
                href={`tel:${String(data.visit_phone).replace(/\s+/g, "")}`}
                className="text-[#7d5530] font-medium underline-offset-2 hover:underline"
              >
                {String(data.visit_phone)}
              </a>
            </div>
          )}
        </div>
      ) : null}

      {filledGroups.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Pomiar utworzony, ale nie wypełniony żaden szczegół. Kliknij Edytuj żeby uzupełnić.
        </p>
      ) : (
        filledGroups.map((g) => (
          <div key={g.title} className="border-t border-zinc-100 pt-2">
            <h3 className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1.5">
              {g.title}
            </h3>
            {g.title === "AGD do zabudowy" ? (
              <AgdRows data={data} />
            ) : g.title === "Okucia i szuflady" ? (
              <OkuciaRows data={data} fields={schema.groups.find((s) => s.title === g.title)?.fields ?? []} />
            ) : g.title === "Pomieszczenie" ? (
              <div className="flex flex-col gap-2">
                <RoomMiniDiagram data={data} />
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  {g.rows
                    .filter((r) => !ROOM_DIAGRAM_KEYS.has(r.field.key))
                    .map((r) => (
                      <RenderRow key={r.field.key} field={r.field} value={r.value} />
                    ))}
                </dl>
                <DerivedVent data={data} />
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {g.rows.map((r) => (
                  <RenderRow key={r.field.key} field={r.field} value={r.value} />
                ))}
              </dl>
            )}
          </div>
        ))
      )}

      {brief.notes && (
        <div className="border-t border-zinc-100 pt-2">
          <h3 className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1">
            Notatki
          </h3>
          <p className="text-xs whitespace-pre-wrap text-zinc-800">{brief.notes}</p>
        </div>
      )}
    </section>
  );
}

function RenderRow({
  field,
  value: rawValue,
}: {
  field: BriefField;
  value: string | number | boolean | number[] | null | undefined;
}) {
  if (Array.isArray(rawValue)) return null;
  if (field.key === "lift_breakdown" && typeof rawValue === "string") {
    try {
      const parsed: unknown = JSON.parse(rawValue);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const total = parsed.reduce((sum, e) => {
          const c = typeof (e as { count?: unknown })?.count === "number"
            ? (e as { count: number }).count
            : Number((e as { count?: unknown })?.count);
          return Number.isFinite(c) ? sum + c : sum;
        }, 0);
        return (
          <>
            <dt className="text-zinc-500 break-words">Siłowniki — typy</dt>
            <dd className="text-zinc-900 font-medium break-words">
              <ul className="flex flex-col gap-0.5">
                {parsed.map((e, i) => {
                  const type = typeof (e as { type?: unknown })?.type === "string" ? (e as { type: string }).type : "";
                  const count = (e as { count?: unknown })?.count;
                  return (
                    <li key={i}>
                      <span className="text-zinc-500">{type || "—"}: </span>
                      <span>{String(count)} szt</span>
                    </li>
                  );
                })}
                {total > 0 && (
                  <li className="text-zinc-500 text-xs pt-0.5">Łącznie: <span className="text-zinc-900 font-medium">{total} szt</span></li>
                )}
              </ul>
            </dd>
          </>
        );
      }
    } catch {
      // fall through
    }
    return null;
  }
  if (field.key === "hinges_breakdown" && typeof rawValue === "string") {
    try {
      const parsed: unknown = JSON.parse(rawValue);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const TYPE_LABELS: Record<string, string> = {
          "110": "110°",
          "155": "155°",
          "rownolegle": "Równoległe",
        };
        const total = parsed.reduce((sum, e) => {
          const c = typeof (e as { count?: unknown })?.count === "number"
            ? (e as { count: number }).count
            : Number((e as { count?: unknown })?.count);
          return Number.isFinite(c) ? sum + c : sum;
        }, 0);
        return (
          <>
            <dt className="text-zinc-500 break-words">Zawiasy — rozbicie</dt>
            <dd className="text-zinc-900 font-medium break-words">
              <ul className="flex flex-col gap-0.5">
                {parsed.map((e, i) => {
                  const type = typeof (e as { type?: unknown })?.type === "string" ? (e as { type: string }).type : "";
                  const count = (e as { count?: unknown })?.count;
                  return (
                    <li key={i}>
                      <span className="text-zinc-500">{TYPE_LABELS[type] ?? type}: </span>
                      <span>{String(count)} szt</span>
                    </li>
                  );
                })}
                {total > 0 && (
                  <li className="text-zinc-500 text-xs pt-0.5">Łącznie: <span className="text-zinc-900 font-medium">{total} szt</span></li>
                )}
              </ul>
            </dd>
          </>
        );
      }
    } catch {
      // fall through
    }
    return null;
  }
  if (field.key === "corpus_list" && typeof rawValue === "string") {
    try {
      const parsed: unknown = JSON.parse(rawValue);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return (
          <>
            <dt className="text-zinc-500 break-words">Korpusy</dt>
            <dd className="text-zinc-900 font-medium break-words">
              <ul className="flex flex-col gap-0.5">
                {parsed.map((e, i) => {
                  const label = typeof (e as { label?: unknown })?.label === "string" ? (e as { label: string }).label : "";
                  const color = typeof (e as { color?: unknown })?.color === "string" ? (e as { color: string }).color : "";
                  const edgeColor = typeof (e as { edgeColor?: unknown })?.edgeColor === "string" ? (e as { edgeColor: string }).edgeColor : "";
                  return (
                    <li key={i}>
                      {label && <span className="text-zinc-500">{label}: </span>}
                      <span>{color}</span>
                      {edgeColor && (
                        <span className="text-zinc-500"> · krawędź: <span className="text-zinc-900">{edgeColor}</span></span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </dd>
          </>
        );
      }
    } catch {
      // fall through to plain render
    }
    return null;
  }
  const value = rawValue;
  let label = field.label;
  let display: string;
  if (field.type === "checkbox") {
    display = "Tak";
  } else if (field.type === "radio" || field.type === "select") {
    const opt = field.options?.find((o) => o.value === value);
    display = opt?.label ?? String(value);
  } else if (field.type === "number") {
    display = `${value}${field.unit ? ` ${field.unit}` : ""}`;
  } else {
    display = String(value);
  }
  if (field.key === "worktop_joints_count") {
    label = "Łączenie blatu";
    display = `${value} szt zestaw łączenia`;
  }
  return (
    <>
      <dt className="text-zinc-500 break-words">{label}</dt>
      <dd className="text-zinc-900 font-medium break-words">{display}</dd>
    </>
  );
}

type AgdSpec = {
  flag: string;
  label: string;
  details: { key: string; map?: Record<string, string> }[];
};

const HOB_TYPE: Record<string, string> = { indukcyjna: "indukcyjna", gazowa: "gazowa" };
const MOUNT_LABEL: Record<string, string> = { zabudowa: "do zabudowy", wolnostojacy: "wolnostojący", wolnostojaca: "wolnostojąca", wolnowiszacy: "wolnowiszący" };
const HOOD_TYPE: Record<string, string> = { komin: "komin", wegiel: "filtry węglowe" };
const DW_WIDTH: Record<string, string> = { "45": "45 cm", "60": "60 cm" };
const SINK_TYPE: Record<string, string> = { nablatowy: "nablatowy", podblatowy: "podblatowy" };

const AGD_SPECS: AgdSpec[] = [
  { flag: "agd_hob", label: "Płyta", details: [{ key: "agd_hob_type", map: HOB_TYPE }] },
  { flag: "agd_oven", label: "Piekarnik", details: [{ key: "agd_oven_model" }] },
  { flag: "agd_microwave", label: "Mikrofalówka", details: [{ key: "agd_microwave_model" }] },
  { flag: "agd_coffee", label: "Ekspres", details: [{ key: "agd_coffee_type", map: MOUNT_LABEL }, { key: "agd_coffee_model" }] },
  { flag: "agd_thermomix", label: "Termomix", details: [{ key: "agd_thermomix_notes" }] },
  { flag: "agd_hood", label: "Okap", details: [{ key: "agd_hood_mount", map: MOUNT_LABEL }, { key: "agd_hood_type", map: HOOD_TYPE }] },
  { flag: "agd_dishwasher", label: "Zmywarka", details: [{ key: "agd_dishwasher_width", map: DW_WIDTH }, { key: "agd_dishwasher_model" }] },
  { flag: "agd_fridge", label: "Lodówka", details: [{ key: "agd_fridge_type", map: MOUNT_LABEL }, { key: "agd_fridge_spec" }] },
  { flag: "agd_sink_type", label: "Zlewozmywak", details: [{ key: "agd_sink_type", map: SINK_TYPE }] },
];

function DerivedVent({ data }: { data: BriefData }) {
  const fridgeBuiltin = data.agd_fridge === true && data.agd_fridge_type === "zabudowa";
  const hoodBuiltin = data.agd_hood === true && data.agd_hood_mount === "zabudowa";
  if (!fridgeBuiltin && !hoodBuiltin) return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-amber-800 mb-0.5">
        Auto z AGD — do wyceny kratek
      </p>
      <ul className="text-xs text-amber-900 flex flex-col gap-0.5">
        {fridgeBuiltin && <li>· Wentylacja lodówki do zabudowy — 2 szt kratki (cokół + góra)</li>}
        {hoodBuiltin && <li>· Kratka wywiewu okapu do zabudowy — 1 szt</li>}
      </ul>
    </div>
  );
}

type Consolidation = { primary: string; label: string; detailKeys: string[] };

const OKUCIA_CONSOLIDATIONS: Consolidation[] = [
  { primary: "drawer_internal", label: "Szuflady wewnętrzne", detailKeys: ["drawer_internal_notes", "drawer_internal_insert"] },
  { primary: "drawer_tray", label: "Szuflada tackowa", detailKeys: ["drawer_tray_type", "drawer_tray_slides", "drawer_tray_notes"] },
  { primary: "servo_drive", label: "Servo-Drive", detailKeys: ["servo_drive_where"] },
];

function OkuciaRows({ data, fields }: { data: BriefData; fields: BriefField[] }) {
  const consumed = new Set<string>(OKUCIA_CONSOLIDATIONS.flatMap((c) => c.detailKeys));
  const byPrimary = new Map(OKUCIA_CONSOLIDATIONS.map((c) => [c.primary, c]));

  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
      {fields.map((f) => {
        if (consumed.has(f.key)) return null;
        const spec = byPrimary.get(f.key);
        if (spec) {
          const on = data[spec.primary] === true;
          const parts = spec.detailKeys
            .map((k) => data[k])
            .filter((v): v is string => typeof v === "string" && v.trim() !== "")
            .map((v) => v.trim());
          if (!on && parts.length === 0) return null;
          return (
            <span key={f.key} className="col-span-2 grid grid-cols-2 gap-x-3">
              <dt className="text-zinc-500 break-words">{spec.label}</dt>
              <dd className="text-zinc-900 font-medium break-words">
                {parts.length > 0 ? parts.join(" · ") : "Tak"}
              </dd>
            </span>
          );
        }
        const value = data[f.key];
        const empty =
          f.type === "checkbox"
            ? value !== true
            : value === undefined || value === null || value === "";
        if (empty) return null;
        return <RenderRow key={f.key} field={f} value={value} />;
      })}
    </dl>
  );
}

function AgdRows({ data }: { data: BriefData }) {
  const rows = AGD_SPECS.map((spec) => {
    const flagVal = data[spec.flag];
    const on = flagVal === true || (typeof flagVal === "string" && flagVal.trim() !== "");
    const parts = spec.details
      .map((d) => {
        const raw = data[d.key];
        if (raw === undefined || raw === null || raw === "") return null;
        const s = String(raw);
        return d.map ? (d.map[s] ?? s) : s;
      })
      .filter((p): p is string => p !== null);
    if (!on && parts.length === 0) return null;
    return { label: spec.label, parts };
  }).filter((r): r is { label: string; parts: string[] } => r !== null);

  const notesRaw = data["agd_notes"];
  const notes = typeof notesRaw === "string" ? notesRaw.trim() : "";

  return (
    <ul className="flex flex-col gap-1 text-xs">
      {rows.map((r) => (
        <li key={r.label} className="break-words">
          <span className="text-zinc-500">{r.label}</span>
          {r.parts.length > 0 && (
            <span className="text-zinc-900 font-medium">: {r.parts.join(" · ")}</span>
          )}
        </li>
      ))}
      {notes && (
        <li className="break-words pt-1">
          <span className="text-zinc-500">Uwagi:</span>{" "}
          <span className="text-zinc-900 whitespace-pre-wrap">{notes}</span>
        </li>
      )}
    </ul>
  );
}
