"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivateMode } from "./PrivateModeProvider";
import {
  PRIMARY_NAV,
  FINANCE_CHILDREN,
  TOOLS_CHILDREN,
  type NavChild,
} from "./nav/navConfig";

/**
 * Nawigacja desktop. Te same 5 obszarów co BottomNav, plus rozwinięte podstrony
 * dla Finanse i Więcej — bogatszy dostęp na dużym ekranie, identyczna mapa pojęć.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const { priv, toggle } = usePrivateMode();
  if (pathname.startsWith("/login")) return null;

  const childActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const renderChildren = (children: NavChild[]) => (
    <div className="mt-0.5 mb-1 ml-[38px] flex flex-col gap-0.5 border-l border-[#ededea] pl-2.5">
      {children.map((c) => {
        const active = childActive(c.href);
        return (
          <Link
            key={c.href}
            href={c.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-md px-2 py-1.5 text-[13px] transition-colors",
              active
                ? "text-[#a06f3f] font-semibold bg-[#f7efe2]"
                : "text-[#6f6c66] hover:text-[#1f1d1b] hover:bg-[#f0f0ee]",
            ].join(" ")}
          >
            {c.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <aside
      aria-label="Nawigacja desktop"
      className="hidden md:flex md:flex-col md:sticky md:top-[18px] md:h-[calc(100vh-36px)] md:w-[240px] md:rounded-[18px] md:border md:border-[#ededea] md:bg-white md:px-3 md:py-5 md:z-30 md:overflow-hidden"
    >
      <Link
        href="/"
        aria-label="Strona główna"
        className="px-3 pb-4 block rounded-lg hover:bg-[#f0f0ee] transition-colors"
      >
        <div className="text-[18px] font-bold tracking-[4px] text-[#1f1d1b]">LUVIANO</div>
        <div className="text-[10px] tracking-[2px] uppercase text-[#8d8a85] mt-1">app</div>
      </Link>

      <Link
        href="/jobs/new"
        className="mx-1 mb-3 flex items-center gap-2 rounded-xl px-3.5 py-3 text-[14px] font-bold text-white shadow-[0_6px_14px_rgba(160,111,63,.25)]"
        style={{ background: "linear-gradient(160deg, #a06f3f, #7d5530)" }}
      >
        <span className="text-[18px] leading-none">+</span>
        Nowe zlecenie
      </Link>

      <nav className="flex-1 overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-0.5">
          {PRIMARY_NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            const children =
              item.key === "finanse"
                ? FINANCE_CHILDREN
                : item.key === "wiecej"
                  ? TOOLS_CHILDREN
                  : null;
            return (
              <div key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-2.5 rounded-[10px] px-2 py-2 text-[14px] transition-colors",
                    active
                      ? "bg-[#f1e5d2] text-[#a06f3f] font-semibold"
                      : "text-[#4a4843] hover:bg-[#f0f0ee] hover:text-[#1f1d1b]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex w-8 h-8 rounded-lg items-center justify-center shrink-0",
                      active ? "bg-white text-[#a06f3f]" : "bg-[#f4f4f2] text-[#6f6c66]",
                    ].join(" ")}
                  >
                    <Icon active={active} />
                  </span>
                  <span>{item.label}</span>
                </Link>
                {children && renderChildren(children)}
              </div>
            );
          })}
        </div>
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={priv}
        className={[
          "mx-1 mt-3 mb-1 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
          priv ? "border-[#a06f3f] bg-[#f1e5d2]" : "border-[#ededea] bg-white hover:bg-[#f0f0ee]",
        ].join(" ")}
      >
        <span
          className={[
            "w-8 h-8 rounded-lg flex items-center justify-center text-[14px]",
            priv ? "bg-white text-[#a06f3f]" : "bg-[#f0f0ee] text-[#6f6c66]",
          ].join(" ")}
        >
          {priv ? "🔒" : "👁"}
        </span>
        <span className="flex-1 leading-tight">
          <span className="block text-[13px] font-semibold text-[#1f1d1b]">Tryb prywatny</span>
          <span className="block text-[11px] text-[#8d8a85]">
            {priv ? "kwoty ukryte" : "ukryj kwoty"}
          </span>
        </span>
        <span
          className={[
            "relative w-9 h-5 rounded-full border transition-colors",
            priv ? "bg-[#a06f3f] border-[#a06f3f]" : "bg-[#f0f0ee] border-[#ededea]",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-[1px] w-4 h-4 rounded-full transition-all",
              priv ? "left-[18px] bg-white" : "left-[1px] bg-[#8d8a85]",
            ].join(" ")}
          />
        </span>
      </button>

      <div className="border-t border-[#ededea] mt-2 pt-3 px-2 flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold"
          style={{ background: "linear-gradient(160deg, #a06f3f, #7d5530)" }}
        >
          A
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-[#1f1d1b]">Artur</div>
          <div className="text-[11px] text-[#8d8a85]">LUVIANO · JDG</div>
        </div>
      </div>
    </aside>
  );
}
