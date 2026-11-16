/**
 * JEDNO źródło prawdy dla nawigacji. Sidebar (desktop) i BottomNav (mobile)
 * korzystają z tej samej taksonomii 5 obszarów — dzięki temu mapa aplikacji
 * jest identyczna niezależnie od urządzenia.
 */

type IconProps = { active?: boolean };

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: (p: IconProps) => React.ReactNode;
  /** Czy dana ścieżka należy do tego obszaru (podświetlenie). */
  match: (pathname: string) => boolean;
};

export type NavChild = { href: string; label: string };

const svg = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function HomeIcon({ active }: IconProps) {
  return (
    <svg {...svg} fill={active ? "currentColor" : "none"} stroke="currentColor">
      <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9.5z" />
    </svg>
  );
}
function JobsIcon({ active }: IconProps) {
  return (
    <svg {...svg} fill={active ? "currentColor" : "none"} stroke="currentColor">
      <rect x="4" y="4" width="16" height="18" rx="2" />
      <path d="M9 2h6a1 1 0 0 1 1 1v3H8V3a1 1 0 0 1 1-1z" stroke={active ? "#fff" : "currentColor"} />
      <path d="M8 12h8M8 16h5" stroke={active ? "#fff" : "currentColor"} />
    </svg>
  );
}
function FinanceIcon({ active }: IconProps) {
  return (
    <svg {...svg} fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  );
}
function MoreIcon({ active }: IconProps) {
  return (
    <svg {...svg} fill={active ? "currentColor" : "none"} stroke="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </svg>
  );
}

/** Ścieżki należące do obszaru „Finanse". */
const FINANCE_PATHS = ["/finanse", "/invoices", "/dashboard"];
/** Ścieżki należące do obszaru „Więcej / narzędzia". */
const MORE_PATHS = [
  "/wiecej",
  "/calculator",
  "/materials",
  "/usluga",
  "/timer",
  "/settings",
  "/auto-wycena",
  "/cennik-szafek",
];

const startsAny = (p: string, prefixes: string[]) =>
  prefixes.some((x) => p === x || p.startsWith(x + "/") || p.startsWith(x + "?") || p === x);

export const PRIMARY_NAV: NavItem[] = [
  {
    key: "dzis",
    href: "/",
    label: "Dziś",
    icon: HomeIcon,
    match: (p) => p === "/",
  },
  {
    key: "zlecenia",
    href: "/jobs",
    label: "Zlecenia i klienci",
    icon: JobsIcon,
    match: (p) => p.startsWith("/jobs") || p.startsWith("/briefs") || p.startsWith("/clients"),
  },
  {
    key: "finanse",
    href: "/finanse",
    label: "Finanse",
    icon: FinanceIcon,
    match: (p) => startsAny(p, FINANCE_PATHS),
  },
  {
    key: "wiecej",
    href: "/wiecej",
    label: "Więcej",
    icon: MoreIcon,
    match: (p) => startsAny(p, MORE_PATHS),
  },
];

/** Narzędzia i ustawienia (obszar „Więcej"). */
export const TOOLS_CHILDREN: NavChild[] = [
  { href: "/materials", label: "Cennik" },
  { href: "/calculator", label: "Kalkulator" },
  { href: "/usluga", label: "Stawka /h" },
  { href: "/timer", label: "Licznik czasu" },
  { href: "/settings", label: "Ustawienia" },
];
