"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Strony bez przycisku „wstecz” — nie ma dokąd wracać albo to ekran logowania. */
const HIDDEN = new Set(["/", "/login"]);

/**
 * Stały przycisk „Wstecz” (wraca do poprzedniego ekranu) + przesunięcie palcem od lewej krawędzi.
 * W aplikacji zainstalowanej na ekranie głównym nie ma przycisku przeglądarki, a strzałki w nagłówkach
 * bywają daleko albo ich brak — ten jest zawsze w tym samym miejscu, nad dolną nawigacją.
 */
export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const hidden = HIDDEN.has(pathname);

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  useEffect(() => {
    if (hidden) return;
    let sx = 0;
    let sy = 0;
    let armed = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      armed = e.touches.length === 1 && t.clientX < 22;
      sx = t.clientX;
      sy = t.clientY;
    };
    const end = (e: TouchEvent) => {
      if (!armed) return;
      armed = false;
      const t = e.changedTouches[0];
      if (t.clientX - sx > 90 && Math.abs(t.clientY - sy) < 60) {
        if (window.history.length > 1) router.back();
      }
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchend", end);
    };
  }, [hidden, router]);

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Wstecz — poprzedni ekran"
      className="fixed left-3 z-40 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-4 md:left-auto md:right-4 inline-flex items-center gap-1.5 h-12 pl-3 pr-4 rounded-full border border-[#d9d6d0] bg-white/95 text-[#1f1d1b] text-[14px] font-semibold shadow-lg backdrop-blur active:scale-95 transition-transform"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Wstecz
    </button>
  );
}
