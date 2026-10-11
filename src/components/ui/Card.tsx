import Link from "next/link";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  /** Renderuje kartę jako klikalny link (z hover/active) */
  href?: string;
  /** Wariant wizualny obramowania/tła */
  tone?: "default" | "accent" | "warn" | "muted";
  /** Wewnętrzny padding; false = bez paddingu (np. gdy karta zawiera listę z dzielnikami) */
  padded?: boolean;
};

const TONE: Record<NonNullable<CardProps["tone"]>, string> = {
  default: "border-[#ededea] bg-white",
  accent: "border-[#e2c79c] bg-[linear-gradient(160deg,#fbf1dd_0%,#fff8e9_100%)]",
  warn: "border-[#ecccc0] bg-[#fdf4f1]",
  muted: "border-[#ededea] bg-[#fafaf9]",
};

const BASE =
  "rounded-2xl border shadow-[0_1px_2px_rgba(40,38,36,0.04)]";

/**
 * Podstawowa karta aplikacji. Jedno źródło prawdy dla promienia, obramowania i cienia.
 * Gdy podasz `href`, karta staje się linkiem z interakcją hover/active.
 */
export default function Card({
  children,
  className = "",
  href,
  tone = "default",
  padded = true,
}: CardProps) {
  const cls = [
    BASE,
    TONE[tone],
    padded ? "p-4" : "",
    href
      ? "block transition-colors hover:border-[#d8d7d3] active:bg-[#f6f6f5]"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return <div className={cls}>{children}</div>;
}
