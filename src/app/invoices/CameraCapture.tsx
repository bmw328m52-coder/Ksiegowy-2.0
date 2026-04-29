"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
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
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `faktura-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
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
              disabled={!ready}
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
