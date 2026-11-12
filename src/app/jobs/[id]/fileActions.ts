"use server";

import { revalidatePath } from "next/cache";
import { getJob } from "@/lib/dao/jobs";
import {
  createJobFileUpload,
  deleteJobFile,
  insertJobFile,
  jobFileUrl,
  updateJobFileMarks,
} from "@/lib/dao/job_files";
import { JOB_FILE_EXTS, parseMarks, type FileMark, type JobFile, type JobFileExt } from "@/lib/dao/job_files.types";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Nieznany błąd.");

export async function createJobFileUploadAction(
  jobId: string,
  ext: string,
): Promise<{ error?: string; path?: string; token?: string }> {
  try {
    if (!JOB_FILE_EXTS.includes(ext as JobFileExt)) return { error: "Nieobsługiwany format pliku." };
    if (!(await getJob(jobId))) return { error: "Zlecenie nie istnieje." };
    return await createJobFileUpload(ext as JobFileExt);
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function addJobFileAction(
  jobId: string,
  input: { name: string; file_path: string; width: number; height: number },
): Promise<{ error?: string; file?: JobFile }> {
  try {
    const width = Math.round(input.width);
    const height = Math.round(input.height);
    if (!(width > 0 && height > 0)) return { error: "Nie udało się odczytać obrazu." };
    const file = await insertJobFile({
      job_id: jobId,
      name: input.name.trim().slice(0, 120) || "Projekt",
      file_path: input.file_path,
      width,
      height,
    });
    revalidatePath(`/jobs/${jobId}`);
    return { file };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function saveJobFileMarksAction(
  id: string,
  jobId: string,
  marks: FileMark[],
): Promise<{ error?: string }> {
  try {
    await updateJobFileMarks(id, parseMarks(marks));
    revalidatePath(`/jobs/${jobId}`);
    return {};
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function deleteJobFileAction(id: string, jobId: string): Promise<{ error?: string }> {
  try {
    await deleteJobFile(id);
    revalidatePath(`/jobs/${jobId}`);
    return {};
  } catch (e) {
    return { error: msg(e) };
  }
}

/** Świeży link, gdy ten ze strony wygasł (strona otwarta dłużej niż godzinę albo z pamięci offline). */
export async function jobFileUrlAction(id: string): Promise<{ url?: string }> {
  try {
    return { url: (await jobFileUrl(id)) ?? undefined };
  } catch {
    return {};
  }
}
