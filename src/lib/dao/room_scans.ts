import { createClient } from "@/lib/supabase/server";
import type { RoomScan } from "./room_scans.types";
import { SCAN_PHOTOS_BUCKET, scanPhotoPath } from "./room_scans.types";

const photoIds = (scan: Pick<RoomScan, "data">) => (scan.data.markers ?? []).flatMap((mk) => mk.photos ?? []);

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

/** Podpisane linki (1 h) do zdjęć punktów instalacji: id zdjęcia → URL. */
export async function scanPhotoUrls(scans: RoomScan[]): Promise<Record<string, string>> {
  const paths = scans.flatMap((s) => photoIds(s).map((p) => scanPhotoPath(s.user_id, p)));
  if (paths.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(SCAN_PHOTOS_BUCKET).createSignedUrls(paths, 3600);
  // Brak bucketu (migracja 0048 niewgrana) — zlecenie bez miniatur, ale działa.
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const d of data) {
    if (d.signedUrl && d.path) out[d.path.slice(d.path.lastIndexOf("/") + 1, -".jpg".length)] = d.signedUrl;
  }
  return out;
}

export async function deleteScan(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: scan } = await supabase.from("room_scans").select("user_id,data").eq("id", id).maybeSingle();
  const { error } = await supabase.from("room_scans").delete().eq("id", id);
  if (error) throw error;
  if (scan) {
    const paths = photoIds(scan as RoomScan).map((p) => scanPhotoPath(scan.user_id, p));
    if (paths.length > 0) await supabase.storage.from(SCAN_PHOTOS_BUCKET).remove(paths);
  }
}
