import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { PageContainer } from "@/components/ui";
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
    <PageContainer width="narrow">
      <PageHeader title="Edycja briefu" back={{ href: `/briefs/${id}` }} />
      <BriefForm
        action={bound}
        clientId={client.id}
        clientName={client.name}
        initial={brief}
      />
    </PageContainer>
  );
}
