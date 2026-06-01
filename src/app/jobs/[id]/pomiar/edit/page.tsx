import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import BriefForm from "@/app/briefs/BriefForm";
import { getJob } from "@/lib/dao/jobs";
import { getBriefByJob } from "@/lib/dao/quote_briefs";
import { createPomiarForJobAction, updatePomiarAction } from "@/app/jobs/actions";

export const metadata = { title: "Edytuj pomiar" };

export default async function EditPomiarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const brief = await getBriefByJob(id);

  const action = brief
    ? updatePomiarAction.bind(null, brief.id, id)
    : createPomiarForJobAction.bind(null, id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader
          title={brief ? "Edytuj pomiar" : "Wypełnij pomiar"}
          back={{ href: `/jobs/${id}` }}
        />
        <BriefForm
          action={action}
          clientId={job.client_id}
          clientName={job.client_name}
          initial={brief ?? undefined}
          defaults={
            brief
              ? undefined
              : {
                  title: job.title,
                  project_type: job.project_type ?? "kitchen",
                  visit_date: job.start_date ?? new Date().toISOString().slice(0, 10),
                  notes: job.notes,
                }
          }
          submitLabel={brief ? "Zapisz pomiar" : "Utwórz pomiar"}
          openPostByDefault={job.status === "after_measure"}
        />
      </div>
    </main>
  );
}
