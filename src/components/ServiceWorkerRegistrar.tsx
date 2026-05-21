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

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const reg = () =>
        navigator.serviceWorker
          .register("/sw.js", { scope: "/", updateViaCache: "none" })
          .catch(() => {});
      if (document.readyState === "complete") reg();
      else window.addEventListener("load", reg, { once: true });
    }

    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
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
