import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getBrief } from "@/lib/dao/quote_briefs";
import { getClient } from "@/lib/dao/clients";
import { getJob } from "@/lib/dao/jobs";
import { PROJECT_TYPE_LABELS } from "@/lib/dao/job_checklist.types";
import { getBriefSchema } from "@/lib/briefSchema";
import { fmtPLN, fmtDate } from "@/lib/format";
import {
  deleteBriefAction,
  convertBriefToJobAction,
} from "../actions";
import BriefStatusSelect from "./BriefStatusSelect";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await getBrief(id);
  return { title: brief?.title ?? "Brief" };
}

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = await getBrief(id);
  if (!brief) notFound();

  const [client, linkedJob] = await Promise.all([
    getClient(brief.client_id),
    brief.job_id ? getJob(brief.job_id) : Promise.resolve(null),
  ]);

  const schema = getBriefSchema(brief.project_type);
  const data = brief.data;

  const convertBind = convertBriefToJobAction.bind(null, id);
  const deleteBind = deleteBriefAction.bind(null, id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6 gap-5">
      <div className="w-full max-w-md mx-auto flex flex-col gap-4">
        <PageHeader
          title={brief.title}
          back={{ href: client ? `/clients/${client.id}` : "/clients" }}
          action={
            <Link
              href={`/briefs/${id}/edit`}
              className="text-sm text-zinc-600 underline-offset-2 hover:underline"
            >
              Edytuj
            </Link>
          }
        />

        <section className="rounded-xl border border-zinc-200 bg-white p-4 text-sm flex flex-col gap-1">
          <p><span className="text-zinc-500">Klient: </span>
            {client ? (
              <Link href={`/clients/${client.id}`} className="underline-offset-2 hover:underline">
                {client.name}
              </Link>
            ) : "—"}
          </p>
          <p><span className="text-zinc-500">Typ: </span>{PROJECT_TYPE_LABELS[brief.project_type]}</p>
          {brief.visit_date && (
            <p><span className="text-zinc-500">Pomiar: </span>{fmtDate(brief.visit_date)}</p>
          )}
          {brief.estimated_amount !== null && (
            <p><span className="text-zinc-500">Wstępna wycena: </span>
              <span className="font-medium tabular-nums">{fmtPLN(brief.estimated_amount)}</span>
            </p>
          )}
          {linkedJob && (
            <p><span className="text-zinc-500">Zlecenie: </span>
              <Link href={`/jobs/${linkedJob.id}`} className="underline-offset-2 hover:underline">
                {linkedJob.title}
              </Link>
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <BriefStatusSelect briefId={id} current={brief.status} />
        </section>

        {schema.groups.map((group) => {
          const rows = group.fields
            .map((f) => ({ field: f, value: data[f.key] }))
            .filter((r) => {
              if (r.field.type === "checkbox") return r.value === true;
              return r.value !== undefined && r.value !== null && r.value !== "";
            });
          if (rows.length === 0) return null;
          return (
            <section key={group.title} className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-700 mb-2">{group.title}</h3>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {rows.map((r) => (
                  <RenderRow key={r.field.key} field={r.field} value={r.value} />
                ))}
              </dl>
            </section>
          );
        })}

        {brief.notes && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-2">Notatki</h3>
            <p className="text-sm whitespace-pre-wrap text-zinc-800">{brief.notes}</p>
          </section>
        )}

        {!brief.job_id ? (
          <form action={convertBind}>
            <ConfirmSubmitButton
              message="Utworzyć zlecenie z tego briefu? Tytuł, typ projektu i wstępna kwota zostaną przeniesione, brief otrzyma status 'Zlecenie utworzone'."
              formNoValidate
              className="w-full rounded-lg bg-accent text-white py-3 font-medium active:opacity-80"
            >
              Utwórz zlecenie z briefu
            </ConfirmSubmitButton>
          </form>
        ) : (
          linkedJob && (
            <Link
              href={`/jobs/${linkedJob.id}`}
              className="w-full inline-flex justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 py-3 text-sm font-medium active:bg-zinc-50"
            >
              Otwórz powiązane zlecenie
            </Link>
          )
        )}

        <form action={deleteBind} className="mt-4">
          <ConfirmSubmitButton
            message="Usunąć brief? Tej operacji nie da się cofnąć."
            formNoValidate
            className="w-full text-sm text-red-600 py-3 active:underline"
          >
            Usuń brief
          </ConfirmSubmitButton>
        </form>
      </div>
    </main>
  );
}

function RenderRow({
  field,
  value: rawValue,
}: {
  field: import("@/lib/briefSchema").BriefField;
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
