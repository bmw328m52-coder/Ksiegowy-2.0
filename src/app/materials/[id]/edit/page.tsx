import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getCatalogItem } from "@/lib/dao/material_catalog";
import { updateCatalogAction } from "../../actions";
import EditCatalogForm from "./EditCatalogForm";

export const metadata = { title: "Edytuj materiał" };

export default async function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getCatalogItem(id);
  if (!item) notFound();

  const action = updateCatalogAction.bind(null, id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Edytuj materiał" back={{ href: "/materials" }} />
        <EditCatalogForm action={action} initial={item} />
      </div>
    </main>
  );
}
