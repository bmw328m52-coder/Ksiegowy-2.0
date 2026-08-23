"use client";

import { useEffect, useState } from "react";

export default function ServiceWorkerRegistrar() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);

    let onVisible: (() => void) | undefined;

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      // Gdy nowy service worker przejmie kontrolę (po deployu), przeładuj raz,
      // żeby apka pobrała świeże pliki zamiast trzymać nieaktualny cache.
      const hadController = !!navigator.serviceWorker.controller;
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing || !hadController) return;
        refreshing = true;
        window.location.reload();
      });

      let registration: ServiceWorkerRegistration | undefined;
      const reg = () =>
        navigator.serviceWorker
          .register("/sw.js", { scope: "/", updateViaCache: "none" })
          .then((r) => {
            registration = r;
            // Sprawdź od razu, czy jest nowsza wersja workera.
            r.update().catch(() => {});
          })
          .catch(() => {});
      if (document.readyState === "complete") reg();
      else window.addEventListener("load", reg, { once: true });

      // Po powrocie do apki (odblokowanie PWA, przełączenie kart) sprawdź,
      // czy jest nowszy build — nowy SW podłapie się bez ręcznego czyszczenia.
      onVisible = () => {
        if (document.visibilityState === "visible") {
          registration?.update().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 z-50 rounded-full bg-amber-500 text-white text-xs font-medium px-3 py-1 shadow-md"
      style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      Tryb offline — zapisy wstrzymane
    </div>
  );
}
