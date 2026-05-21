import Link from "next/link";
import type { QuoteBrief } from "@/lib/dao/quote_briefs";
import { getBriefSchema, type BriefField } from "@/lib/briefSchema";
import { PROJECT_TYPE_LABELS } from "@/lib/dao/job_checklist.types";
import { fmtDate } from "@/lib/format";

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
          <span>Data: <span className="text-zinc-800 font-medium">{fmtDate(brief.visit_date)}</span></span>
        )}
      </div>

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
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {g.rows.map((r) => (
                <RenderRow key={r.field.key} field={r.field} value={r.value} />
              ))}
            </dl>
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
  const value = rawValue;
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
  return (
    <>
      <dt className="text-zinc-500 break-words">{field.label}</dt>
      <dd className="text-zinc-900 font-medium break-words">{display}</dd>
    </>
  );
}
