"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivateMode } from "./PrivateModeProvider";

type Tone = "info" | "ok" | "warn" | "accent" | "neutral";

type Item = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: (props: { active: boolean }) => React.ReactNode;
  tone: Tone;
  badge?: string;
};

type Section = { title: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: "Workflow",
    items: [
      { href: "/", label: "Start", match: (p) => p === "/", icon: HomeIcon, tone: "accent" },
      { href: "/jobs", label: "Zlecenia", match: (p) => p.startsWith("/jobs"), icon: ClipboardListIcon, tone: "info" },
      { href: "/clients", label: "Klienci", match: (p) => p.startsWith("/clients"), icon: UsersIcon, tone: "ok" },
    ],
  },
  {
    title: "Finanse",
    items: [
      { href: "/invoices", label: "Faktury", match: (p) => p.startsWith("/invoices"), icon: ReceiptIcon, tone: "warn" },
      { href: "/dashboard", label: "Dashboard", match: (p) => p.startsWith("/dashboard"), icon: ChartIcon, tone: "info" },
    ],
  },
  {
    title: "Narzędzia",
    items: [
      { href: "/calculator", label: "Kalkulator", match: (p) => p.startsWith("/calculator"), icon: CalcIcon, tone: "info" },
      { href: "/usluga", label: "Stawka /h", match: (p) => p.startsWith("/usluga"), icon: ClockIcon, tone: "ok" },
      { href: "/settings", label: "Ustawienia", match: (p) => p.startsWith("/settings"), icon: GearIcon, tone: "neutral" },
    ],
  },
];

const TONE_BG: Record<Tone, string> = {
  info: "bg-[#dde5ef] text-[#5a7898]",
  ok: "bg-[#e3efe5] text-[#4f8a64]",
  warn: "bg-[#f4e0d9] text-[#b8523a]",
  accent: "bg-[#ebe8e3] text-[#57534e]",
  neutral: "bg-[#f5f3ef] text-[#6f6457]",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { priv, toggle } = usePrivateMode();
  if (pathname.startsWith("/login")) return null;

  return (
    <aside
      aria-label="Nawigacja desktop"
      className="hidden md:flex md:flex-col md:sticky md:top-[18px] md:h-[calc(100vh-36px)] md:w-[240px] md:rounded-[18px] md:border md:border-[#e6dcc7] md:bg-white md:px-3 md:py-5 md:z-30 md:overflow-hidden"
    >
      <div className="px-3 pb-4">
        <div className="text-[18px] font-bold tracking-[4px] text-[#282624]">LUVIANO</div>
        <div className="text-[10px] tracking-[2px] uppercase text-[#9c9081] mt-1">Manager Firmy</div>
      </div>

      <Link
        href="/jobs/new"
        className="mx-1 mb-3 flex items-center gap-2 rounded-xl px-3.5 py-3 text-[14px] font-bold text-white shadow-[0_6px_14px_rgba(40,38,36,.25)]"
        style={{ background: "linear-gradient(160deg, #57534e, #3a3633)" }}
      >
        <span className="text-[18px] leading-none">+</span>
        Nowe zlecenie
      </Link>

      <nav className="flex-1 overflow-y-auto">
        {SECTIONS.map((sec) => (
          <div key={sec.title}>
            <div className="px-3 pt-3 pb-1.5 text-[10px] tracking-[2px] uppercase text-[#9c9081]">
              {sec.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {sec.items.map((it) => {
                const active = it.match(pathname);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center gap-2.5 rounded-[10px] px-2 py-2 text-[14px] transition-colors",
                      active
                        ? "bg-[#ebe8e3] text-[#282624] font-semibold"
                        : "text-[#524d48] hover:bg-[#f5f3ef] hover:text-[#282624]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-flex w-7 h-7 rounded-lg items-center justify-center shrink-0",
                        active ? "bg-white text-[#282624]" : TONE_BG[it.tone],
                      ].join(" ")}
                    >
                      <Icon active={active} />
                    </span>
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={priv}
        className={[
          "mx-1 mt-3 mb-1 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
          priv
            ? "border-[#282624] bg-[#ebe8e3]"
            : "border-[#e8e4dd] bg-white hover:bg-[#f5f3ef]",
        ].join(" ")}
      >
        <span
          className={[
            "w-8 h-8 rounded-lg flex items-center justify-center text-[14px]",
            priv ? "bg-[#ebe8e3] text-[#282624]" : "bg-[#f5f3ef] text-[#6f6457]",
          ].join(" ")}
        >
          {priv ? "🔒" : "👁"}
        </span>
        <span className="flex-1 leading-tight">
          <span className="block text-[13px] font-semibold text-[#282624]">Tryb prywatny</span>
          <span className="block text-[11px] text-[#9c9081]">
            {priv ? "kwoty ukryte" : "ukryj kwoty"}
          </span>
        </span>
        <span
          className={[
            "relative w-9 h-5 rounded-full border transition-colors",
            priv ? "bg-[#282624] border-[#282624]" : "bg-[#f5f3ef] border-[#e8e4dd]",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-[1px] w-4 h-4 rounded-full transition-all",
              priv ? "left-[18px] bg-white" : "left-[1px] bg-[#9c9081]",
            ].join(" ")}
          />
        </span>
      </button>

      <div className="border-t border-[#e8e4dd] mt-2 pt-3 px-2 flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold"
          style={{ background: "linear-gradient(160deg, #57534e, #3a3633)" }}
        >
          A
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-[#282624]">Artur</div>
          <div className="text-[11px] text-[#9c9081]">LUVIANO · JDG</div>
        </div>
      </div>
    </aside>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9.5z" />
    </svg>
  );
}

function ClipboardListIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="18" rx="2" />
      <path d="M9 2h6a1 1 0 0 1 1 1v3H8V3a1 1 0 0 1 1-1z" />
      <path d="M8 12h8M8 16h5" strokeWidth="1.7" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ReceiptIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.7"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  );
}

function CalcIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" strokeWidth="2.4" />
    </svg>
  );
}

function ClockIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
