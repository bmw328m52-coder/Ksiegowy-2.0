"use client";

import { useActionState, useRef, useState } from "react";
import { uploadAndOcrInvoice } from "./actions";
import CameraCapture from "./CameraCapture";

type Source = "camera" | "file" | null;

export default function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadAndOcrInvoice, { error: undefined });
  const [fileName, setFileName] = useState<string>("");
  const [source, setSource] = useState<Source>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCaptured = (f: File) => {
    setCameraOpen(false);
    const input = cameraInputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    input.files = dt.files;
    setFileName(f.name);
    setSource("camera");
    formRef.current?.requestSubmit();
  };

  return (
    <>
      {cameraOpen && (
        <CameraCapture onClose={() => setCameraOpen(false)} onCapture={handleCaptured} />
      )}
      <form ref={formRef} action={formAction} className="w-full flex flex-col gap-3">
        <input
          ref={cameraInputRef}
          type="file"
          name="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          disabled={pending || source === "file"}
        />

        <button
          type="button"
          disabled={pending || source === "file"}
          onClick={() => setCameraOpen(true)}
          className={`rounded-xl bg-accent text-white p-6 flex flex-col items-center gap-2 active:opacity-80 ${
            pending ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <CameraIcon />
          <span className="text-base font-medium">
            {fileName && source === "camera" ? "Zrób zdjęcie ponownie" : "Zrób zdjęcie faktury"}
          </span>
        </button>

        <label
          className={`rounded-xl border-2 border-dashed border-zinc-300 bg-white py-3 px-4 flex items-center justify-center gap-2 active:bg-zinc-50 cursor-pointer ${
            pending ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <input
            type="file"
            name="file"
            accept="application/pdf"
            className="sr-only"
            disabled={pending || source === "camera"}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              setFileName(f?.name ?? "");
              setSource(f ? "file" : null);
              if (f) {
                if (cameraInputRef.current) cameraInputRef.current.value = "";
                formRef.current?.requestSubmit();
              }
            }}
          />
          <FileIcon />
          <span className="text-sm font-medium text-zinc-700">
            {fileName && source === "file" ? "Zmień plik PDF" : "lub wybierz plik PDF"}
          </span>
        </label>

        {fileName && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-300 px-3 py-2 text-sm">
            <span className="text-emerald-700 font-medium">✓ Gotowe: </span>
            <span className="font-medium break-all">{fileName}</span>
            <p className="text-xs text-emerald-700 mt-1">
              Kliknij niżej &quot;Wgraj i odczytaj&quot;, żeby przetworzyć fakturę.
            </p>
          </div>
        )}

        {state.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !fileName}
          className="rounded-lg bg-accent text-white py-3 font-medium active:opacity-80 disabled:opacity-50"
        >
          {pending ? "Analizuję fakturę..." : "Wgraj i odczytaj"}
        </button>

        {pending && (
          <p className="text-xs text-zinc-500 text-center">
            Claude AI rozpoznaje dane z faktury — to może potrwać 5–20 sekund.
          </p>
        )}
      </form>
    </>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-zinc-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v6h6" />
    </svg>
  );
}
