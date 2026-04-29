"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function InvoicePhotoViewer({ src }: { src: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) {
      root.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onFsChange = () => {
      if (!document.fullscreenElement) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full active:opacity-80"
        aria-label="Powiększ zdjęcie faktury"
      >
        <Image
          src={src}
          alt="Faktura"
          width={800}
          height={1100}
          className="w-full h-auto"
          unoptimized
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          style={{ height: "100dvh", width: "100dvw" }}
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt="Faktura"
            className="max-w-full max-h-full object-contain"
            style={{ touchAction: "manipulation" }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            aria-label="Zamknij"
            className="absolute top-4 right-4 rounded-full bg-black/60 text-white w-10 h-10 flex items-center justify-center text-xl font-medium"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
