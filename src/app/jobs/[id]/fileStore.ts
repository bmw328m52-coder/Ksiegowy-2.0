// Pamięć tabletu dla plików projektu: obrazy (Cache API) i niewysłane poprawki (localStorage).
// Dzięki temu rzuty otwierają się u klienta bez zasięgu, a poprawki zrobione offline
// wysyłają się po odzyskaniu sieci.

import { parseMarks, type FileMark } from "@/lib/dao/job_files.types";

// Celowo bez prefiksu „mf-" — service worker kasuje swoje stare cache przy każdej nowej wersji.
const IMAGE_CACHE = "luviano-job-files-v1";
// Klucz zawiera ścieżkę obrazu: kartka wysłana ponownie ze Skanera dostaje nową ścieżkę w tym samym wierszu.
type CachedFile = { id: string; file_path: string };
const cacheBase = (id: string) => `/__job-file/${id}`;
const cacheKey = (f: CachedFile) => `${cacheBase(f.id)}?p=${encodeURIComponent(f.file_path)}`;
const marksKey = (id: string) => `jobfile.marks.${id}`;

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(IMAGE_CACHE);
  } catch {
    return null;
  }
}

export async function cachedImage(f: CachedFile): Promise<Blob | null> {
  try {
    const hit = await (await openCache())?.match(cacheKey(f));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

export async function cacheImage(f: CachedFile, blob: Blob): Promise<void> {
  try {
    const cache = await openCache();
    // Poprzednia wersja obrazu tego pliku nie jest już potrzebna.
    await cache?.delete(cacheBase(f.id), { ignoreSearch: true });
    await cache?.put(cacheKey(f), new Response(blob, { headers: { "Content-Type": blob.type } }));
  } catch {
    // Brak miejsca / tryb prywatny — obraz po prostu pobierze się ponownie.
  }
}

export async function uncacheImage(id: string): Promise<void> {
  try {
    await (await openCache())?.delete(cacheBase(id), { ignoreSearch: true });
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
