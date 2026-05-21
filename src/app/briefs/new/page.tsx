import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getClient } from "@/lib/dao/clients";
import BriefForm from "../BriefForm";
import { createBriefAction } from "../actions";
import { PROJECT_TYPES, type ProjectType } from "@/lib/dao/job_checklist.types";

export const metadata = { title: "Nowy brief" };

export default async function NewBriefPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; type?: string }>;
}) {
  const { clientId, type } = await searchParams;
  if (!clientId) redirect("/clients");

  const client = await getClient(clientId);
  if (!client) notFound();

  const defaultType: ProjectType | undefined = PROJECT_TYPES.includes(type as ProjectType)
    ? (type as ProjectType)
    : undefined;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Nowy brief" back={{ href: `/clients/${clientId}` }} />
        <BriefForm
          action={createBriefAction}
          clientId={client.id}
          clientName={client.name}
          defaultProjectType={defaultType}
        />
      </div>
    </main>
  );
}
