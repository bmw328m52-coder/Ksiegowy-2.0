"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export type Theme = "light" | "dark";
const KEY = "luviano-theme";
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "light",
  setTheme: () => {},
});
export const useTheme = () => useContext(ThemeCtx);

/** Jasny ciepły motyw (domyślny) i ciemny grafit+szampan dla całej aplikacji (poza statyczną stroną offline). */
export default function AppAppearance({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("motyw");
      const fromUrl = q === "ciemny" ? "dark" : q === "jasny" ? "light" : null;
      const stored = window.localStorage.getItem(KEY);
      const next = (fromUrl ?? (stored === "dark" ? "dark" : "light")) as Theme;
      if (fromUrl) window.localStorage.setItem(KEY, fromUrl);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(next);
    } catch {}
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(KEY, t);
    } catch {}
  }, []);

  const premium = pathname !== "/offline";
  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      <div className={premium ? `luviano-premium theme-${theme} min-h-screen` : "min-h-screen"}>{children}</div>
    </ThemeCtx.Provider>
  );
}
