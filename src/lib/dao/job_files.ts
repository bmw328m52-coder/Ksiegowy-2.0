import { createClient } from "@/lib/supabase/server";
import { JOB_FILES_BUCKET, parseMarks, type FileMark, type JobFile, type JobFileExt } from "./job_files.types";

const toFile = (row: Record<string, unknown>): JobFile => ({ ...(row as JobFile), marks: parseMarks(row.marks) });

/** `null` = brak tabeli (migracja 0053 jeszcze nie wgrana) — strona zlecenia ma działać dalej. */
export async function listJobFiles(jobId: string): Promise<JobFile[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_files")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }
  return (data ?? []).map(toFile);
}

/** Podpisane linki (1 h): id pliku → URL. */
export async function jobFileUrls(files: Pick<JobFile, "id" | "file_path">[]): Promise<Record<string, string>> {
  if (files.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(JOB_FILES_BUCKET)
    .createSignedUrls(files.map((f) => f.file_path), 3600);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const d of data) {
    const f = files.find((x) => x.file_path === d.path);
    if (f && d.signedUrl) out[f.id] = d.signedUrl;
  }
  return out;
}

export async function jobFileUrl(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("job_files").select("id,file_path").eq("id", id).maybeSingle();
  if (!row) return null;
  return (await jobFileUrls([row as Pick<JobFile, "id" | "file_path">]))[row.id] ?? null;
}

/** Jednorazowy adres do wgrania pliku prosto z przeglądarki (omija limit 4,5 MB funkcji Vercel). */
export async function createJobFileUpload(ext: JobFileExt): Promise<{ path: string; token: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Brak sesji — zaloguj się ponownie.");
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(JOB_FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Nie udało się przygotować wgrania.");
  return { path, token: data.token };
}

export async function insertJobFile(input: {
  job_id: string;
  name: string;
  file_path: string;
  width: number;
  height: number;
}): Promise<JobFile> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !input.file_path.startsWith(`${auth.user.id}/`)) throw new Error("Zła ścieżka pliku.");
  const { data, error } = await supabase.from("job_files").insert(input).select("*").single();
  if (error) throw error;
  return toFile(data);
}

export async function updateJobFileMarks(id: string, marks: FileMark[]): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_files")
    .update({ marks, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteJobFile(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("job_files").select("file_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("job_files").delete().eq("id", id);
  if (error) throw error;
  if (row?.file_path) await supabase.storage.from(JOB_FILES_BUCKET).remove([row.file_path]);
}

/** Przed usunięciem zlecenia: wiersze znikną kaskadą, ale obrazy w buckecie trzeba zdjąć ręcznie. */
export async function removeJobFilesStorage(jobId: string): Promise<void> {
  const files = await listJobFiles(jobId);
  if (!files || files.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from(JOB_FILES_BUCKET).remove(files.map((f) => f.file_path));
}
