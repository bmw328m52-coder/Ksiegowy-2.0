import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ClientForm from "../../ClientForm";
import { updateClientAction } from "../../actions";
import { getClient } from "@/lib/dao/clients";

export const metadata = { title: "Edycja klienta" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const action = updateClientAction.bind(null, id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Edycja klienta" back={{ href: `/clients/${id}` }} />
        <ClientForm action={action} initial={client} submitLabel="Zapisz zmiany" />
      </div>
    </main>
  );
}
