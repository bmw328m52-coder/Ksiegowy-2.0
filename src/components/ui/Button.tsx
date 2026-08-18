import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary:
    "text-white bg-[linear-gradient(160deg,#a06f3f,#7d5530)] shadow-[0_6px_14px_rgba(160,111,63,.22)] hover:brightness-[1.03] active:brightness-95",
  secondary:
    "text-[#1f1d1b] bg-white border border-[#ededea] hover:bg-[#f6f6f5] active:bg-[#efefee]",
  ghost:
    "text-[#6f6c66] bg-transparent hover:bg-[#f0f0ee] hover:text-[#1f1d1b] active:bg-[#e9e9e7]",
  danger:
    "text-white bg-[#b8523a] hover:brightness-[1.04] active:brightness-95",
};

const SIZE: Record<Size, string> = {
  sm: "text-[13px] px-3 py-1.5 gap-1.5 rounded-lg",
  md: "text-[14px] px-4 py-2.5 gap-2 rounded-xl",
};

const BASE =
  "inline-flex items-center justify-center font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none select-none";

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  icon?: ReactNode;
};

/** Przycisk-akcja (button). Do linków użyj <ButtonLink>. */
export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  icon,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/** Link stylizowany jak przycisk. */
export function ButtonLink({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
  icon,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}>
      {icon}
      {children}
    </Link>
  );
}
