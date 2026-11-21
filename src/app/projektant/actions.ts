"use server";

import { revalidatePath } from "next/cache";
import { reconcileKitchenMaterials, saveKitchenProject } from "@/lib/dao/kitchen_projects";
import { kitchenMaterialLines } from "@/lib/kitchen/materials";
import { getCabinetRates } from "@/lib/dao/cabinet_pricing";
import { listScansByJob } from "@/lib/dao/room_scans";
import { applyOverrides, manualRoom, roomFromScan } from "@/lib/kitchen/room";
import { quoteKitchen } from "@/lib/kitchen/quote";
import { checkProject } from "@/lib/kitchen/rules";
import type { KitchenProject, Room } from "@/lib/kitchen/types";

/** Zapis projektu: wycena liczona NA SERWERZE ze świeżego cennika i skanu — klient nie podaje kwot. */
export async function saveKitchenAction(
  jobId: string,
  projectId: string | null,
  project: KitchenProject,
): Promise<{ ok?: boolean; id?: string; errors?: number; materials?: number; duplicates?: number; error?: string }> {
  try {
    if (!jobId) return { error: "Brak zlecenia." };
    const [{ rates }, scans] = await Promise.all([getCabinetRates(), listScansByJob(jobId)]);
    const scan = scans.find((s) => s.id === project.scan_id) ?? null;
    const base: Room = scan
      ? roomFromScan(scan.data)
      : manualRoom(project.manual_walls ?? [{ id: "A", length_mm: 3600, height_mm: 2600 }]);
    const room = applyOverrides(base, project.overrides ?? {});
    const { snapshot, estimate: est } = quoteKitchen(room, project, rates);
    const errors = checkProject(room, project.items).filter((i) => i.level === "error").length;
    const id = await saveKitchenProject({ id: projectId, jobId, scanId: scan?.id ?? null, data: project, quote: snapshot });
    // wiązanie z wyceną zlecenia (job_materials) — koszt z tego samego cennika co migawka
    const mat = await reconcileKitchenMaterials(jobId, kitchenMaterialLines(est, rates, project.fronts));
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/jobs/${jobId}/wycena`);
    return { ok: true, id, errors, materials: mat.created + mat.updated, duplicates: mat.duplicates };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}
