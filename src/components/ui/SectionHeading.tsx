import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Nagłówek sekcji: mała etykieta wersalikami + opcjonalny link akcji po prawej.
 * Ujednolica wszystkie „mini-nagłówki" na pulpicie i podstronach.
 */
export default function SectionHeading({
  children,
  action,
}: {
  children: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-2 px-0.5">
      <h2 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#9ea29c]">
        {children}
      </h2>
      {action && (
        <Link
          href={action.href}
          className="text-[11px] font-semibold text-[#a06f3f] hover:underline active:opacity-70"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
