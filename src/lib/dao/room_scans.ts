import { createClient } from "@/lib/supabase/server";
import type { RoomScan } from "./room_scans.types";

export async function listScansByJob(jobId: string): Promise<RoomScan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_scans")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  // Brak tabeli (migracja 0047 jeszcze nie wgrana) nie może wywalić strony zlecenia.
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  return (data ?? []) as RoomScan[];
}

export async function deleteScan(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("room_scans").delete().eq("id", id);
  if (error) throw error;
}
