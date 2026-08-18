"use client";

import { usePrivateMode } from "./PrivateModeProvider";

// Przełącznik trybu prywatnego (ukrywanie kwot) osadzony w nagłówku — bez
// pływającego pozycjonowania, żeby nie zasłaniał treści na podstronach.
export default function PrivateModeToggle({ className = "" }: { className?: string }) {
  const { priv, toggle } = usePrivateMode();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={priv}
      aria-label={priv ? "Pokaż kwoty" : "Ukryj kwoty"}
      title={priv ? "Kwoty ukryte — dotknij, aby pokazać" : "Ukryj kwoty"}
      className={[
        "shrink-0 w-10 h-10 rounded-full border flex items-center justify-center text-[16px] transition-colors",
        priv
          ? "bg-[#f1e5d2] border-[#a06f3f] text-[#a06f3f]"
          : "bg-white border-[#ededea] text-[#6f6c66] hover:border-[#d8d7d3] active:bg-[#f6f6f5]",
        className,
      ].join(" ")}
    >
      {priv ? "🔒" : "👁"}
    </button>
  );
}
