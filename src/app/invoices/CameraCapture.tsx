"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("Ta przeglądarka nie obsługuje aparatu. Otwórz aplikację przez HTTPS.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        if (track) {
          try {
            const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
              focusMode?: string[];
            };
            const advanced: MediaTrackConstraintSet[] = [];
            if (caps.focusMode?.includes("continuous")) {
              advanced.push({ focusMode: "continuous" } as MediaTrackConstraintSet);
            }
            if (advanced.length > 0) {
              await track.applyConstraints({ advanced });
            }
          } catch {}
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch (e: unknown) {
        const name = e instanceof Error ? e.name : "";
        if (name === "NotAllowedError") {
          setError("Brak zgody na dostęp do aparatu. Zezwól w ustawieniach przeglądarki.");
        } else if (name === "NotFoundError") {
          setError("Nie znaleziono aparatu w urządzeniu.");
        } else {
          const msg = e instanceof Error ? e.message : "Nieznany błąd";
          setError(`Nie udało się otworzyć aparatu: ${msg}`);
        }
      }
    };

    start();

    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) {
      root.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    }

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const handleCapture = async () => {
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video || !ready || busy) return;
    setBusy(true);

    const fromCanvas = (): Promise<Blob | null> =>
      new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95);
      });

    type ImageCaptureCtor = new (track: MediaStreamTrack) => {
      takePhoto: (opts?: { imageWidth?: number; imageHeight?: number }) => Promise<Blob>;
      getPhotoCapabilities: () => Promise<{
        imageWidth?: { max?: number };
        imageHeight?: { max?: number };
      }>;
    };

    let blob: Blob | null = null;
    try {
      const ICtor = (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
      if (track && ICtor) {
        const ic = new ICtor(track);
        let opts: { imageWidth?: number; imageHeight?: number } | undefined;
        try {
          const caps = await ic.getPhotoCapabilities();
          const w = caps.imageWidth?.max;
          const h = caps.imageHeight?.max;
          if (w && h) opts = { imageWidth: w, imageHeight: h };
        } catch {}
        blob = await ic.takePhoto(opts);
      }
    } catch {}

    if (!blob) blob = await fromCanvas();
    if (!blob) {
      setBusy(false);
      return;
    }
    const file = new File([blob], `faktura-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
    onCapture(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      style={{ height: "100dvh", width: "100dvw" }}
    >
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 gap-4 text-center">
          <p className="text-base">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white text-black px-5 py-2 font-medium"
          >
            Zamknij
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full object-cover bg-black"
          />
          <div
            className="absolute left-0 right-0 bottom-0 flex justify-between items-center px-8 pt-6 gap-4 bg-gradient-to-t from-black/80 to-transparent"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="text-white text-base font-medium px-3 py-2"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleCapture}
              disabled={!ready || busy}
              aria-label="Zrób zdjęcie"
              className="rounded-full bg-white border-4 border-zinc-300 active:bg-zinc-200 disabled:opacity-40 shadow-lg"
              style={{ width: 76, height: 76 }}
            />
            <span style={{ width: 56 }} aria-hidden />
          </div>
        </>
      )}
    </div>
  );
}
