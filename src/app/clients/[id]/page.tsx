import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getClient } from "@/lib/dao/clients";
import { listJobsByClient, JOB_STATUS_LABELS } from "@/lib/dao/jobs";
import { listMaterialCostsByClient } from "@/lib/dao/cost_lines";
import { fmtPLN, fmtDate } from "@/lib/format";
import { deleteClientAction } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, jobs, materials] = await Promise.all([
    getClient(id),
    listJobsByClient(id),
    listMaterialCostsByClient(id),
  ]);
  if (!client) notFound();

  const totalGross = jobs.reduce((acc, j) => acc + Number(j.amount_gross), 0);
  const paidGross = jobs
    .filter((j) => j.status === "paid")
    .reduce((acc, j) => acc + Number(j.amount_gross), 0);

  const materialsTotalGross = materials.reduce(
    (acc, m) => acc + Number(m.amount_gross),
    0
  );

  const deleteWithId = deleteClientAction.bind(null, id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader
          title={client.name}
          back={{ href: "/clients" }}
          action={
            <Link
              href={`/clients/${id}/edit`}
              className="text-sm text-zinc-600 underline-offset-2 hover:underline"
            >
              Edytuj
            </Link>
          }
        />

        <section className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2 text-sm">
          <p>
            <span className="text-zinc-500">Typ: </span>
            {client.type === "company" ? "Firma" : "Osoba prywatna"}
          </p>
          {client.nip && (
            <p>
              <span className="text-zinc-500">NIP: </span>
              {client.nip}
            </p>
          )}
          {client.address && (
            <p>
              <span className="text-zinc-500">Adres: </span>
              {client.address}
            </p>
          )}
          {client.email && (
            <p>
              <span className="text-zinc-500">E-mail: </span>
              <a href={`mailto:${client.email}`} className="underline-offset-2 hover:underline">
                {client.email}
              </a>
            </p>
          )}
          {client.phone && (
            <p>
              <span className="text-zinc-500">Telefon: </span>
              <a href={`tel:${client.phone}`} className="underline-offset-2 hover:underline">
                {client.phone}
              </a>
            </p>
          )}
          {client.notes && <p className="whitespace-pre-wrap text-zinc-700 pt-2">{client.notes}</p>}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Zlecenia</h2>
            <Link
              href={`/jobs/new?clientId=${id}`}
              className="rounded-lg bg-[#282624] text-white px-3 py-1.5 text-sm font-medium active:opacity-80"
            >
              + Nowe zlecenie
            </Link>
          </div>

          {jobs.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2">
                <p className="text-zinc-500">Suma zleceń</p>
                <p className="font-medium text-sm">{fmtPLN(totalGross)}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2">
                <p className="text-zinc-500">Opłacone</p>
                <p className="font-medium text-sm">{fmtPLN(paidGross)}</p>
              </div>
            </div>
          )}

          {jobs.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-6">Brak zleceń.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/jobs/${j.id}`}
                    className="block rounded-xl border border-zinc-200 bg-white p-3 active:bg-zinc-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{j.title}</p>
                        <p className="text-xs text-zinc-500">
                          {fmtPLN(j.amount_gross)} • {fmtDate(j.due_date ?? j.start_date)}
                        </p>
                      </div>
                      <StatusBadge status={j.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Zakupy materiałów</h2>
            {materials.length > 0 && (
              <span className="text-sm font-medium tabular-nums">
                {fmtPLN(materialsTotalGross)}
              </span>
            )}
          </div>

          {materials.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-6">
              Brak zakupów materiałów. Dodawane są przez fakturę kosztową przypisaną do zlecenia z kategorią „materiały”.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {materials.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{m.description}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {fmtDate(m.cost_date)}
                        {m.job_title && ` · ${m.job_title}`}
                        {m.invoice_supplier && ` · ${m.invoice_supplier}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium tabular-nums">{fmtPLN(m.amount_gross)}</p>
                      <p className="text-[11px] text-zinc-500 tabular-nums">
                        netto {fmtPLN(m.amount_net)}
                      </p>
                    </div>
                  </div>
                  {m.invoice_id && (
                    <Link
                      href={`/invoices/${m.invoice_id}`}
                      className="text-xs text-zinc-600 underline-offset-2 hover:underline mt-1 inline-block"
                    >
                      Zobacz fakturę
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <form action={deleteWithId} className="mt-10">
          <button
            type="submit"
            className="w-full text-sm text-red-600 py-3 active:underline"
            formNoValidate
          >
            Usuń klienta
          </button>
        </form>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: keyof typeof JOB_STATUS_LABELS }) {
  const colors: Record<string, string> = {
    planned: "bg-zinc-100 text-zinc-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-amber-100 text-amber-700",
    paid: "bg-green-100 text-green-700",
    cancelled: "bg-zinc-100 text-zinc-400 line-through",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${colors[status]}`}>
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
