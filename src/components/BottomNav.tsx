"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tone = "info" | "ok" | "warn" | "accent" | "neutral";

type Tab = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: (props: { active: boolean }) => React.ReactNode;
  tone: Tone;
};

const TABS: Tab[] = [
  { href: "/", label: "Start", match: (p) => p === "/", icon: HomeIcon, tone: "accent" },
  { href: "/clients", label: "Klienci", match: (p) => p.startsWith("/clients"), icon: UsersIcon, tone: "ok" },
  { href: "/jobs", label: "Zlecenia", match: (p) => p.startsWith("/jobs"), icon: ClipboardListIcon, tone: "info" },
  { href: "/invoices", label: "Faktury", match: (p) => p.startsWith("/invoices"), icon: ReceiptIcon, tone: "warn" },
  { href: "/dashboard", label: "Dashboard", match: (p) => p.startsWith("/dashboard"), icon: ChartIcon, tone: "info" },
];

const TONE_BG: Record<Tone, string> = {
  info: "bg-[#dde5ef] text-[#5a7898]",
  ok: "bg-[#e3efe5] text-[#4f8a64]",
  warn: "bg-[#f4e0d9] text-[#b8523a]",
  accent: "bg-[#ebe8e3] text-[#57534e]",
  neutral: "bg-[#f5f3ef] text-[#6f6457]",
};

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;

  return (
    <nav
      aria-label="Główna nawigacja"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-[#e8e4dd] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-md mx-auto flex">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 active:bg-[#faf7f2] ${
                active ? "text-[#282624]" : "text-[#6f6457]"
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[#282624]"
                />
              )}
              <span
                className={[
                  "inline-flex w-9 h-9 rounded-lg items-center justify-center",
                  active ? "bg-[#282624] text-white" : TONE_BG[tab.tone],
                ].join(" ")}
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

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9.5z" />
    </svg>
  );
}

function ReceiptIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z" />
      <path d="M9 7h6" stroke={active ? "#fff" : "currentColor"} />
      <path d="M9 11h6" stroke={active ? "#fff" : "currentColor"} />
      <path d="M9 15h4" stroke={active ? "#fff" : "currentColor"} />
    </svg>
  );
}

function ClipboardListIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="18" rx="2" />
      <path d="M9 2h6a1 1 0 0 1 1 1v3H8V3a1 1 0 0 1 1-1z" stroke={active ? "#fff" : "currentColor"} />
      <path d="M8 12h8M8 16h5" stroke={active ? "#fff" : "currentColor"} strokeWidth="1.7" />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? "2.2" : "1.7"}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
