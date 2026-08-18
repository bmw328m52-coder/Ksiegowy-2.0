"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV } from "./nav/navConfig";

/**
 * Dolna nawigacja (mobile). 5 obszarów z tej samej konfiguracji co Sidebar —
 * identyczna taksonomia na telefonie i desktopie.
 */
export default function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;

  return (
    <nav
      aria-label="Główna nawigacja"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-[#ededea] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-md mx-auto flex">
        {PRIMARY_NAV.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 active:bg-[#f6f6f5] ${
                active ? "text-[#1f1d1b]" : "text-[#6f6c66]"
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#a06f3f]"
                />
              )}
              <span
                className={[
                  "inline-flex w-9 h-9 rounded-lg items-center justify-center transition-colors",
                  active ? "text-white" : "text-[#6f6c66]",
                ].join(" ")}
                style={
                  active
                    ? { background: "linear-gradient(160deg, #a06f3f, #7d5530)" }
                    : undefined
                }
              >
                <Icon active={active} />
              </span>
              <span className={`text-[10px] tracking-tight ${active ? "font-semibold" : ""}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
