"use server";

import { revalidatePath } from "next/cache";
import { deleteScan } from "@/lib/dao/room_scans";

export async function deleteScanAction(formData: FormData): Promise<void> {
  const id = String(formData.get("scan_id") ?? "");
  const jobId = String(formData.get("job_id") ?? "");
  if (!id) return;
  await deleteScan(id);
  revalidatePath(`/jobs/${jobId}`);
}
