import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import BriefForm from "@/app/briefs/BriefForm";
import { createPomiarAction } from "../actions";
import { getClient, listClients } from "@/lib/dao/clients";
import { PROJECT_TYPES, type ProjectType } from "@/lib/dao/job_checklist.types";
import ClientPicker from "./ClientPicker";

export const metadata = { title: "Nowe zlecenie" };

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; type?: string }>;
}) {
  const { clientId, type } = await searchParams;

  if (!clientId) {
    const clients = await listClients().catch(() => []);
    const lite = clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
    return (
      <main className="flex flex-1 flex-col px-4 py-6">
        <div className="w-full max-w-md mx-auto">
          <PageHeader title="Nowe zlecenie" back={{ href: "/" }} />
          <p className="text-[13px] text-[#6b6661] -mt-2 mb-3 px-1">
            Wybierz klienta lub dodaj nowego — potem przejdziesz do formularza pomiaru.
          </p>
          <ClientPicker clients={lite} />
        </div>
      </main>
    );
  }

  const client = await getClient(clientId);
  if (!client) notFound();

  const defaultType: ProjectType | undefined = PROJECT_TYPES.includes(type as ProjectType)
    ? (type as ProjectType)
    : undefined;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Nowy pomiar" back={{ href: "/jobs/new" }} />
        <BriefForm
          action={createPomiarAction}
          clientId={client.id}
          clientName={client.name}
          defaultProjectType={defaultType}
          submitLabel="Zapisz pomiar"
        />
      </div>
    </main>
  );
}
