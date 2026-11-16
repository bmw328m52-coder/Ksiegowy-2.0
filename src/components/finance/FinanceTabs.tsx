"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Sub = { href: string; label: string; match: (p: string) => boolean };
type Group = {
  key: string;
  href: string;
  label: string;
  hint: string;
  match: (p: string) => boolean;
  subs?: Sub[];
};

const is = (p: string, base: string) => p === base || p.startsWith(base + "/");

/** Pięć obszarów Finansów — jedna, stała nawigacja na wszystkich ekranach modułu. */
const GROUPS: Group[] = [
  {
    key: "przeglad",
    href: "/finanse",
    label: "Przegląd",
    hint: "Wynik miesiąca i co wymaga uwagi",
    match: (p) => p === "/finanse",
  },
  {
    key: "faktury",
    href: "/invoices",
    label: "Faktury",
    hint: "Koszty, sprzedaż, dotacja",
    match: (p) => is(p, "/invoices"),
    subs: [
      { href: "/invoices", label: "Kosztowe", match: (p) => p === "/invoices" || (is(p, "/invoices") && !is(p, "/invoices/sprzedaz") && !is(p, "/invoices/dotacja")) },
      { href: "/invoices/sprzedaz", label: "Sprzedażowe", match: (p) => is(p, "/invoices/sprzedaz") },
      { href: "/invoices/dotacja", label: "Z dotacji", match: (p) => is(p, "/invoices/dotacja") },
    ],
  },
  {
    key: "rentownosc",
    href: "/finanse/rentownosc",
    label: "Rentowność",
    hint: "Ile zostaje ze zlecenia",
    match: (p) => is(p, "/finanse/rentownosc"),
  },
  {
    key: "podatki",
    href: "/dashboard",
    label: "Podatki i ZUS",
    hint: "VAT, PIT, ZUS i terminy",
    match: (p) => is(p, "/dashboard") || is(p, "/finanse/terminy"),
    subs: [
      { href: "/dashboard", label: "Bilans VAT/PIT", match: (p) => is(p, "/dashboard") },
      { href: "/finanse/terminy", label: "Terminy", match: (p) => is(p, "/finanse/terminy") },
    ],
  },
  {
    key: "ksiegowosc",
    href: "/finanse/ksiegowosc",
    label: "Księgowość",
    hint: "ING i raporty miesięczne",
    match: (p) => is(p, "/finanse/ksiegowosc") || is(p, "/finanse/raporty"),
    subs: [
      { href: "/finanse/ksiegowosc", label: "Księgowość ING", match: (p) => is(p, "/finanse/ksiegowosc") },
      { href: "/finanse/raporty", label: "Raporty", match: (p) => is(p, "/finanse/raporty") },
    ],
  },
];

export default function FinanceTabs() {
  const pathname = usePathname() ?? "";
  const active = GROUPS.find((g) => g.match(pathname)) ?? GROUPS[0];

  return (
    <div className="lf-tabs-wrap">
      <nav aria-label="Finanse" className="lf-tabs">
        {GROUPS.map((g) => {
          const on = g.key === active.key;
          return (
            <Link key={g.key} href={g.href} aria-current={on ? "page" : undefined} data-on={on} className="lf-tab">
              {g.label}
            </Link>
          );
        })}
      </nav>
      {active.subs && (
        <nav aria-label={`${active.label} — widoki`} className="lf-subs">
          {active.subs.map((s) => {
            const on = s.match(pathname);
            return (
              <Link key={s.href} href={s.href} aria-current={on ? "page" : undefined} data-on={on} className="lf-sub">
                {s.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
