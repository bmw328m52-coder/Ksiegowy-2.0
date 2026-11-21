import PageHeader from "@/components/PageHeader";
import { PageContainer } from "@/components/ui";
import { getCabinetRates } from "@/lib/dao/cabinet_pricing";
import { getKitchenProject } from "@/lib/dao/kitchen_projects";
import { listScansByJob } from "@/lib/dao/room_scans";
import { roomFromScan } from "@/lib/kitchen/room";
import KitchenDesigner from "./KitchenDesigner";

export const metadata = { title: "Projektant kuchni" };

/** /projektant — tryb ręczny; /projektant?job=ID[&scan=ID] — geometria ze skanu zlecenia + zapis projektu. */
export default async function ProjektantPage({ searchParams }: { searchParams: Promise<{ job?: string; scan?: string }> }) {
  const { job, scan: scanId } = await searchParams;
  const { rates } = await getCabinetRates();
  const scans = job ? await listScansByJob(job) : [];
  const kitchenScans = scans.filter((s) => (s.data.room_type ?? "kitchen") === "kitchen");
  const saved = job ? await getKitchenProject(job) : null;
  const scan = kitchenScans.find((s) => s.id === (scanId ?? saved?.scan_id)) ?? kitchenScans[0] ?? null;
  return (
    <PageContainer width="app">
      <PageHeader title="Projektant kuchni" back={{ href: job ? `/jobs/${job}` : "/wiecej" }} />
      <KitchenDesigner
        rates={rates}
        jobId={job ?? null}
        scanId={scan?.id ?? null}
        scanName={scan?.name ?? null}
        scanRoom={scan ? roomFromScan(scan.data) : null}
        saved={saved && saved.scan_id === (scan?.id ?? null) ? { id: saved.id, project: saved.data } : null}
      />
    </PageContainer>
  );
}
