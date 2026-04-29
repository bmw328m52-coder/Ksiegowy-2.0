import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import JobForm from "../JobForm";
import { createJobAction } from "../actions";
import { getClient } from "@/lib/dao/clients";

export const metadata = { title: "Nowe zlecenie" };

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  if (!clientId) redirect("/clients");
  const client = await getClient(clientId);
  if (!client) notFound();

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Nowe zlecenie" back={{ href: `/clients/${clientId}` }} />
        <JobForm
          action={createJobAction}
          clientId={clientId}
          clientName={client.name}
          submitLabel="Zapisz zlecenie"
        />
      </div>
    </main>
  );
}
