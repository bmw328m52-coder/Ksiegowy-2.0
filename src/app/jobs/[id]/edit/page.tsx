import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import JobForm from "../../JobForm";
import { updateJobAction } from "../../actions";
import { getJob } from "@/lib/dao/jobs";

export const metadata = { title: "Edycja zlecenia" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  const action = updateJobAction.bind(null, id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Edycja zlecenia" back={{ href: `/jobs/${id}` }} />
        <JobForm
          action={action}
          clientId={job.client_id}
          clientName={job.client_name}
          initial={job}
          submitLabel="Zapisz zmiany"
        />
      </div>
    </main>
  );
}
