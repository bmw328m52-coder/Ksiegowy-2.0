import PageHeader from "@/components/PageHeader";
import { listCatalog } from "@/lib/dao/material_catalog";
import AddCatalogForm from "./AddCatalogForm";
import ImportMercuryButton from "./ImportMercuryButton";
import ImportZimexButton from "./ImportZimexButton";
import MaterialsBrowser from "./MaterialsBrowser";
import { PageContainer, Card } from "@/components/ui";

export const metadata = { title: "Cennik" };

export default async function MaterialsPage() {
  const items = await listCatalog();

  return (
    <PageContainer width="narrow">
      <PageHeader title="Cennik" back={{ href: "/wiecej" }} />

      <AddCatalogForm />
      <ImportMercuryButton />
      <ImportZimexButton />

      <Card href="/auto-wycena" className="flex items-center gap-3">
        <span className="inline-flex w-10 h-10 rounded-xl items-center justify-center shrink-0 bg-[#f1e5d2] text-[#a06f3f]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </span>
        <span className="min-w-0 flex flex-col">
          <span className="text-[15px] font-semibold tracking-tight text-[#1f1d1b]">
            Domyślne ceny wyceny
          </span>
          <span className="text-[12px] text-[#6f6c66]">Automatyczne wycenianie z pomiaru</span>
        </span>
        <span className="ml-auto text-[#c9c7c2]">→</span>
      </Card>

      <MaterialsBrowser items={items} />
    </PageContainer>
  );
}
