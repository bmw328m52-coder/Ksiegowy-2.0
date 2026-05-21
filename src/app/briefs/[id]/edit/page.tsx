import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getBrief } from "@/lib/dao/quote_briefs";
import { getClient } from "@/lib/dao/clients";
import BriefForm from "../../BriefForm";
import { updateBriefAction } from "../../actions";

export const metadata = { title: "Edycja briefu" };

export default async function EditBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = await getBrief(id);
  if (!brief) notFound();
  const client = await getClient(brief.client_id);
  if (!client) notFound();

  const bound = updateBriefAction.bind(null, id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Edycja briefu" back={{ href: `/briefs/${id}` }} />
        <BriefForm
          action={bound}
          clientId={client.id}
          clientName={client.name}
          initial={brief}
        />
      </div>
    </main>
  );
}
