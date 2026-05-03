"use client";

import { useEffect, useState } from "react";
import { dismissToast, subscribeToasts, type Toast } from "@/lib/toast";

const KIND_STYLES: Record<Toast["kind"], string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-zinc-800 text-white",
};

export default function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={`pointer-events-auto w-full max-w-sm rounded-lg shadow-lg px-4 py-3 text-sm font-medium text-left active:opacity-90 ${KIND_STYLES[t.kind]}`}
          style={{ animation: "toast-in 180ms ease-out" }}
        >
          <div className="flex items-start gap-2">
            <Glyph kind={t.kind} />
            <span className="flex-1 break-words">{t.message}</span>
          </div>
        </button>
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Glyph({ kind }: { kind: Toast["kind"] }) {
  if (kind === "success") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (kind === "error") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
