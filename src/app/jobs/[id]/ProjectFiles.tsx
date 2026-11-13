"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { JOB_FILES_BUCKET, type FileMark, type JobFile } from "@/lib/dao/job_files.types";
import { MarksLayer } from "./FileMarks";
import ProjectFileEditor from "./ProjectFileEditor";
import {
  addJobFileAction,
  createJobFileUploadAction,
  deleteJobFileAction,
  jobFileUrlAction,
  saveJobFileMarksAction,
} from "./fileActions";
import { cacheImage, cachedImage, clearLocalMarks, readLocalMarks, uncacheImage } from "./fileStore";

type Prepared = { name: string; blob: Blob; width: number; height: number };

const KEEP_TYPES = ["image/jpeg", "image/png", "image/webp"];
const KEEP_MAX_BYTES = 12 * 1024 * 1024;
const KEEP_MAX_EDGE = 6000;
const REENCODE_EDGE = 4000;
const PDF_EDGE = 2600;
const PDF_MAX_PAGES = 40;

const baseName = (name: string) => name.replace(/\.[^.]+$/, "") || "Projekt";
const extOf = (blob: Blob) => (blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg");

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Nie udało się zapisać obrazu."))), "image/jpeg", 0.9),
  );
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Tego pliku nie da się otworzyć jako obrazu."));
    };
    img.src = url;
  });
}

async function prepareImage(file: File): Promise<Prepared> {
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const name = baseName(file.name);
  if (KEEP_TYPES.includes(file.type) && file.size <= KEEP_MAX_BYTES && Math.max(w, h) <= KEEP_MAX_EDGE) {
    return { name, blob: file, width: w, height: h };
  }
  // HEIC z iPada, BMP, bardzo duże pliki — przepisujemy na JPEG w rozsądnym rozmiarze.
  const k = Math.min(1, REENCODE_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Przeglądarka nie pozwala przetworzyć obrazu.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { name, blob: await toJpeg(canvas), width: canvas.width, height: canvas.height };
}

// PDF (np. „Drukuj → Zapisz jako PDF" z PRO100): każda strona staje się osobnym obrazem,
// żeby dało się po niej rysować tak samo jak po zrzucie.
async function preparePdf(file: File): Promise<Prepared[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: Prepared[] = [];
  const pages = Math.min(doc.numPages, PDF_MAX_PAGES);
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PDF_EDGE / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Przeglądarka nie pozwala przetworzyć PDF.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push({
      name: pages > 1 ? `${baseName(file.name)} — str. ${n}` : baseName(file.name),
      blob: await toJpeg(canvas),
      width: canvas.width,
      height: canvas.height,
    });
  }
  await doc.destroy();
  return out;
}

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(f.name);

export default function ProjectFiles({
  jobId,
  initial,
  urls,
}: {
  jobId: string;
  initial: JobFile[];
  urls: Record<string, string>;
}) {
  const [files, setFiles] = useState<JobFile[]>(initial);
  // id pliku → adres obrazu w pamięci przeglądarki; `null` = nie udało się pobrać (offline).
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const requested = useRef(new Set<string>());
  const objectUrls = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const showImage = (id: string, blob: Blob | null) => {
    const url = blob ? URL.createObjectURL(blob) : null;
    if (url) objectUrls.current.push(url);
    setImages((prev) => ({ ...prev, [id]: url }));
  };

  // Obrazy: najpierw z pamięci tabletu, inaczej z sieci (i od razu do pamięci na później).
  useEffect(() => {
    for (const f of files) {
      if (requested.current.has(f.id)) continue;
      requested.current.add(f.id);
      void (async () => {
        let blob = await cachedImage(f);
        if (!blob) {
          const get = async (url: string | undefined) => {
            if (!url) return null;
            const res = await fetch(url).catch(() => null);
            return res?.ok ? await res.blob() : null;
          };
          blob = (await get(urls[f.id])) ?? (await get((await jobFileUrlAction(f.id).catch(() => ({ url: undefined }))).url));
          if (blob) void cacheImage(f, blob);
        }
        showImage(f.id, blob);
      })();
    }
  }, [files, urls]);

  useEffect(() => {
    const made = objectUrls.current;
    return () => made.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Poprawki zrobione bez sieci (zostały w localStorage) — pokaż je i dośl na serwer.
  useEffect(() => {
    void (async () => {
      for (const f of initial) {
        const local = readLocalMarks(f.id);
        if (!local) continue;
        setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, marks: local } : x)));
        const res = await saveJobFileMarksAction(f.id, jobId, local).catch(() => ({ error: "offline" }));
        if (!res.error && JSON.stringify(readLocalMarks(f.id)) === JSON.stringify(local)) clearLocalMarks(f.id);
      }
    })();
  }, [initial, jobId]);

  async function addFiles(list: File[]) {
    const picked = list.filter((f) => isPdf(f) || isImage(f));
    if (picked.length === 0) {
      setError("Dodaj obraz (JPG, PNG) albo PDF.");
      return;
    }
    setError(null);
    try {
      const supabase = createClient();
      for (const f of picked) {
        setBusy(`Przygotowuję: ${f.name}`);
        const prepared = isPdf(f) ? await preparePdf(f) : [await prepareImage(f)];
        for (const [i, p] of prepared.entries()) {
          setBusy(prepared.length > 1 ? `Wgrywam: ${p.name} (${i + 1}/${prepared.length})` : `Wgrywam: ${p.name}`);
          const target = await createJobFileUploadAction(jobId, extOf(p.blob));
          if (target.error || !target.path || !target.token) throw new Error(target.error ?? "Nie udało się przygotować wgrania.");
          const up = await supabase.storage
            .from(JOB_FILES_BUCKET)
            .uploadToSignedUrl(target.path, target.token, p.blob, { contentType: p.blob.type });
          if (up.error) throw new Error(up.error.message);
          const saved = await addJobFileAction(jobId, {
            name: p.name,
            file_path: target.path,
            width: p.width,
            height: p.height,
          });
          if (saved.error || !saved.file) throw new Error(saved.error ?? "Nie udało się zapisać pliku.");
          const file = saved.file;
          requested.current.add(file.id);
          void cacheImage(file, p.blob);
          showImage(file.id, p.blob);
          setFiles((prev) => [...prev, file]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wgrać pliku.");
    } finally {
      setBusy(null);
    }
  }

  // Ctrl+V ze zrzutem ekranu (np. Wycinanie w Windows po zaznaczeniu widoku w PRO100).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (openId || busy) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const pasted = [...(e.clipboardData?.files ?? [])].filter((f) => isPdf(f) || isImage(f));
      if (pasted.length === 0) return;
      e.preventDefault();
      const stamp = new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      void addFiles(
        pasted.map((f) => (/^image\.\w+$/i.test(f.name) ? new File([f], `Zrzut ${stamp}.png`, { type: f.type }) : f)),
      );
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, busy]);

  async function remove(id: string) {
    setOpenId(null);
    const res = await deleteJobFileAction(id, jobId).catch(() => ({ error: "Brak połączenia — plik nie został usunięty." }));
    if (res.error) {
      setError(res.error);
      return;
    }
    clearLocalMarks(id);
    void uncacheImage(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const setMarks = (id: string, marks: FileMark[]) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, marks } : f)));

  const open = files.find((f) => f.id === openId);
  const openSrc = open ? images[open.id] : null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void addFiles([...e.dataTransfer.files]);
      }}
      className={dragOver ? "rounded-lg outline outline-2 outline-offset-4 outline-[#a06f3f]" : undefined}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {files.map((f) => {
          const src = images[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => src && setOpenId(f.id)}
              className="group text-left"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[#ededea] bg-[var(--surface-2)]">
                {src ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={f.name} className="absolute inset-0 h-full w-full object-contain" />
                    <MarksLayer marks={f.marks} width={f.width} height={f.height} className="absolute inset-0 h-full w-full" />
                  </>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] text-[#8d8a85]">
                    {src === null ? "Niedostępne bez sieci" : "Wczytuję…"}
                  </span>
                )}
                {f.marks.length > 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#a06f3f] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    poprawki
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-xs text-[#6f6c66]">{f.name}</p>
            </button>
          );
        })}

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-sm font-medium text-[#6f6c66] active:bg-[#f0f0ee] disabled:opacity-60"
        >
          <span className="text-xl leading-none">+</span>
          <span>{busy ? "Wgrywam…" : "Dodaj"}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          const list = [...(e.target.files ?? [])];
          e.target.value = "";
          if (list.length > 0) void addFiles(list);
        }}
      />

      {busy && <p className="mt-2 text-xs text-[#8d8a85]">{busy}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {files.length === 0 && !busy && (
        <p className="mt-2 text-[11px] text-[#8d8a85]">
          Zrzuty albo PDF z PRO100. Na komputerze możesz też przeciągnąć plik tutaj albo wkleić zrzut (Ctrl+V).
        </p>
      )}

      {open && openSrc && (
        <ProjectFileEditor
          key={open.id}
          file={open}
          src={openSrc}
          onMarks={setMarks}
          onClose={() => setOpenId(null)}
          onDelete={remove}
        />
      )}
    </div>
  );
}
