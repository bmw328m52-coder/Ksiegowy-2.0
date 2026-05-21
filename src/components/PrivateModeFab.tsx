"use client";

import { usePathname } from "next/navigation";
import { usePrivateMode } from "./PrivateModeProvider";

export default function PrivateModeFab() {
  const { priv, toggle } = usePrivateMode();
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={priv}
      aria-label={priv ? "Wyłącz tryb prywatny" : "Włącz tryb prywatny"}
      title={priv ? "Tryb prywatny — kwoty ukryte" : "Włącz tryb prywatny"}
      className={[
        "md:hidden fixed z-40 top-[max(env(safe-area-inset-top),0.5rem)] right-3",
        "w-10 h-10 rounded-xl border flex items-center justify-center text-[16px] shadow-sm transition-colors",
        priv
          ? "bg-[#ebe8e3] border-[#282624] text-[#282624]"
          : "bg-white/95 backdrop-blur border-[#e8e4dd] text-[#6f6457]",
      ].join(" ")}
    >
      {priv ? "🔒" : "👁"}
    </button>
  );
}
