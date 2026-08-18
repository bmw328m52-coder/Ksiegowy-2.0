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
import { PageContainer, Card, ButtonLink } from "@/components/ui";

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
    <PageContainer width="narrow">
      <PageHeader
        title={brief.title}
        back={{ href: client ? `/clients/${client.id}` : "/clients" }}
        action={
          <ButtonLink href={`/briefs/${id}/edit`} variant="secondary" size="sm">
            Edytuj
          </ButtonLink>
        }
      />

      <Card className="text-sm flex flex-col gap-1">
        <p><span className="text-[#8d8a85]">Klient: </span>
          {client ? (
            <Link href={`/clients/${client.id}`} className="text-[#a06f3f] underline-offset-2 hover:underline">
              {client.name}
            </Link>
          ) : "—"}
        </p>
        <p><span className="text-[#8d8a85]">Typ: </span>{PROJECT_TYPE_LABELS[brief.project_type]}</p>
        {brief.visit_date && (
          <p><span className="text-[#8d8a85]">Pomiar: </span>{fmtDate(brief.visit_date)}</p>
        )}
        {brief.estimated_amount !== null && (
          <p><span className="text-[#8d8a85]">Wstępna wycena: </span>
            <span className="font-semibold tabular-nums text-[#1f1d1b]">{fmtPLN(brief.estimated_amount)}</span>
          </p>
        )}
        {linkedJob && (
          <p><span className="text-[#8d8a85]">Zlecenie: </span>
            <Link href={`/jobs/${linkedJob.id}`} className="text-[#a06f3f] underline-offset-2 hover:underline">
              {linkedJob.title}
            </Link>
          </p>
        )}
      </Card>

      <Card>
        <BriefStatusSelect briefId={id} current={brief.status} />
      </Card>

      {schema.groups.map((group) => {
        const rows = group.fields
          .map((f) => ({ field: f, value: data[f.key] }))
          .filter((r) => {
            if (r.field.type === "checkbox") return r.value === true;
            return r.value !== undefined && r.value !== null && r.value !== "";
          });
        if (rows.length === 0) return null;
        return (
          <Card key={group.title}>
            <h3 className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[#9ea29c] mb-2">{group.title}</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {rows.map((r) => (
                <RenderRow key={r.field.key} field={r.field} value={r.value} />
              ))}
            </dl>
          </Card>
        );
      })}

      {brief.notes && (
        <Card>
          <h3 className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[#9ea29c] mb-2">Notatki</h3>
          <p className="text-sm whitespace-pre-wrap text-[#3a3633]">{brief.notes}</p>
        </Card>
      )}

      {!brief.job_id ? (
        <form action={convertBind}>
          <ConfirmSubmitButton
            message="Utworzyć zlecenie z tego briefu? Tytuł, typ projektu i wstępna kwota zostaną przeniesione, brief otrzyma status 'Zlecenie utworzone'."
            formNoValidate
            className="w-full rounded-xl text-white bg-[linear-gradient(160deg,#a06f3f,#7d5530)] shadow-[0_6px_14px_rgba(160,111,63,.22)] py-3 font-semibold active:brightness-95"
          >
            Utwórz zlecenie z briefu
          </ConfirmSubmitButton>
        </form>
      ) : (
        linkedJob && (
          <Link
            href={`/jobs/${linkedJob.id}`}
            className="w-full inline-flex justify-center rounded-xl border border-[#ededea] bg-white text-[#1f1d1b] py-3 text-sm font-semibold active:bg-[#f6f6f5]"
          >
            Otwórz powiązane zlecenie
          </Link>
        )
      )}

      <form action={deleteBind} className="mt-2">
        <ConfirmSubmitButton
          message="Usunąć brief? Tej operacji nie da się cofnąć."
          formNoValidate
          className="w-full text-sm text-[#b8523a] py-3 active:underline"
        >
          Usuń brief
        </ConfirmSubmitButton>
      </form>
    </PageContainer>
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
      <dt className="text-[#8d8a85] break-words">{field.label}</dt>
      <dd className="text-[#1f1d1b] font-medium break-words">{display}</dd>
    </>
  );
}
