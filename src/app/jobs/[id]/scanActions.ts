"use server";

import { revalidatePath } from "next/cache";
import { deleteScan } from "@/lib/dao/room_scans";
import { saveScanEstimate } from "@/lib/dao/cabinet_pricing";
import { parseChoice, type ScanEstimateChoice } from "@/lib/cabinetPricing";

export async function deleteScanAction(formData: FormData): Promise<void> {
  const id = String(formData.get("scan_id") ?? "");
  const jobId = String(formData.get("job_id") ?? "");
  if (!id) return;
  await deleteScan(id);
  revalidatePath(`/jobs/${jobId}`);
}

export async function saveScanEstimateAction(
  scanId: string,
  jobId: string,
  choice: ScanEstimateChoice
): Promise<{ error?: string; ok?: boolean }> {
  try {
    await saveScanEstimate(scanId, parseChoice(choice));
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}
