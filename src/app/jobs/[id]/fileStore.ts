// Pamięć tabletu dla plików projektu: obrazy (Cache API) i niewysłane poprawki (localStorage).
// Dzięki temu rzuty otwierają się u klienta bez zasięgu, a poprawki zrobione offline
// wysyłają się po odzyskaniu sieci.

import { parseMarks, type FileMark } from "@/lib/dao/job_files.types";

// Celowo bez prefiksu „mf-" — service worker kasuje swoje stare cache przy każdej nowej wersji.
const IMAGE_CACHE = "luviano-job-files-v1";
const cacheKey = (id: string) => `/__job-file/${id}`;
const marksKey = (id: string) => `jobfile.marks.${id}`;

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(IMAGE_CACHE);
  } catch {
    return null;
  }
}

export async function cachedImage(id: string): Promise<Blob | null> {
  try {
    const hit = await (await openCache())?.match(cacheKey(id));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

export async function cacheImage(id: string, blob: Blob): Promise<void> {
  try {
    await (await openCache())?.put(cacheKey(id), new Response(blob, { headers: { "Content-Type": blob.type } }));
  } catch {
    // Brak miejsca / tryb prywatny — obraz po prostu pobierze się ponownie.
  }
}

export async function uncacheImage(id: string): Promise<void> {
  try {
    await (await openCache())?.delete(cacheKey(id));
  } catch {}
}

/** Poprawki zapisane lokalnie, których serwer jeszcze nie potwierdził. */
export function readLocalMarks(id: string): FileMark[] | null {
  try {
    const raw = localStorage.getItem(marksKey(id));
    return raw === null ? null : parseMarks(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalMarks(id: string, marks: FileMark[]): void {
  try {
    localStorage.setItem(marksKey(id), JSON.stringify(marks));
  } catch {}
}

export function clearLocalMarks(id: string): void {
  try {
    localStorage.removeItem(marksKey(id));
  } catch {}
}
