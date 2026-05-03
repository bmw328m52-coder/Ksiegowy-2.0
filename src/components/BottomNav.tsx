"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: (props: { active: boolean }) => React.ReactNode;
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Start",
    match: (p) => p === "/",
    icon: HomeIcon,
  },
  {
    href: "/clients",
    label: "Klienci",
    match: (p) => p.startsWith("/clients"),
    icon: UsersIcon,
  },
  {
    href: "/jobs",
    label: "Zlecenia",
    match: (p) => p.startsWith("/jobs"),
    icon: BriefcaseIcon,
  },
  {
    href: "/invoices",
    label: "Faktury",
    match: (p) => p.startsWith("/invoices"),
    icon: ReceiptIcon,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    match: (p) => p.startsWith("/dashboard"),
    icon: ChartIcon,
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;

  return (
    <nav
      aria-label="Główna nawigacja"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-[#e8e4dd]"
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
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 active:bg-[#faf7f2] ${
                active ? "text-[#282624]" : "text-[#9ea29c]"
              }`}
            >
              <Icon active={active} />
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

function BriefcaseIcon({ active }: { active: boolean }) {
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
      <rect x="2.5" y="7" width="19" height="13" rx="2" />
      <path d="M16 20V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v15" stroke={active ? "#fff" : "currentColor"} />
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
