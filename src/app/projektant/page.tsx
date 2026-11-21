import PageHeader from "@/components/PageHeader";
import { PageContainer } from "@/components/ui";
import { getCabinetRates } from "@/lib/dao/cabinet_pricing";
import KitchenDesigner from "./KitchenDesigner";

export const metadata = { title: "Projektant kuchni" };

export default async function ProjektantPage() {
  const { rates } = await getCabinetRates();
  return (
    <PageContainer width="app">
      <PageHeader title="Projektant kuchni" back={{ href: "/wiecej" }} />
      <KitchenDesigner rates={rates} />
    </PageContainer>
  );
}
