import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { listCatalog } from "@/lib/dao/material_catalog";
import AddCatalogForm from "./AddCatalogForm";
import ImportMercuryButton from "./ImportMercuryButton";
import MaterialsBrowser from "./MaterialsBrowser";

export const metadata = { title: "Cennik" };

export default async function MaterialsPage() {
  const items = await listCatalog();

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Cennik" back={{ href: "/jobs" }} />

        <AddCatalogForm />

        <div className="mt-3">
          <ImportMercuryButton />
        </div>

        <div className="mt-3">
          <Link
            href="/auto-wycena"
            className="block rounded-xl border border-zinc-200 bg-white p-3 text-sm font-medium text-zinc-700 active:bg-zinc-50"
          >
            ⚙ Domyślne ceny wyceny — automatyczne wycenianie z pomiaru →
          </Link>
        </div>

        <MaterialsBrowser items={items} />
      </div>
    </main>
  );
}
