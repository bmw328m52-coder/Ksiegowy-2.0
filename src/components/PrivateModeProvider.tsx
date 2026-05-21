"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Ctx = { priv: boolean; toggle: () => void; set: (v: boolean) => void };

const PrivateModeCtx = createContext<Ctx>({
  priv: false,
  toggle: () => {},
  set: () => {},
});

const STORAGE_KEY = "luviano:privateMode";

export function PrivateModeProvider({ children }: { children: React.ReactNode }) {
  const [priv, setPriv] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setPriv(true);
    } catch {}
  }, []);

  useEffect(() => {
    document.body.classList.toggle("priv", priv);
    try {
      localStorage.setItem(STORAGE_KEY, priv ? "1" : "0");
    } catch {}
  }, [priv]);

  const toggle = useCallback(() => setPriv((v) => !v), []);
  const set = useCallback((v: boolean) => setPriv(v), []);

  return (
    <PrivateModeCtx.Provider value={{ priv, toggle, set }}>
      {children}
    </PrivateModeCtx.Provider>
  );
}

export function usePrivateMode() {
  return useContext(PrivateModeCtx);
}
