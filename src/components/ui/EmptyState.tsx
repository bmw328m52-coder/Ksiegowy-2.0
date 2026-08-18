import type { ReactNode } from "react";
import { ButtonLink } from "./Button";

/**
 * Spójny stan pusty: ikona w kolorowym kafelku, tytuł, podpowiedź i opcjonalne CTA.
 * Używany wszędzie, gdzie lista jest pusta — jeden wygląd w całej aplikacji.
 */
export default function EmptyState({
  icon,
  title,
  hint,
  cta,
  tone = "info",
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  cta?: { href: string; label: string };
  tone?: "info" | "ok" | "accent" | "neutral";
}) {
  const box = {
    info: "bg-[#dde5ef] text-[#5a7898]",
    ok: "bg-[#e3efe5] text-[#4f8a64]",
    accent: "bg-[#f1e5d2] text-[#a06f3f]",
    neutral: "bg-[#f0f0ee] text-[#6f6c66]",
  }[tone];

  return (
    <div className="rounded-2xl border border-dashed border-[#d8d7d3] bg-white/60 px-4 py-8 text-center flex flex-col items-center gap-3">
      <span
        aria-hidden
        className={`inline-flex w-12 h-12 rounded-2xl items-center justify-center ${box}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-[14px] font-semibold text-[#4a4843]">{title}</p>
        {hint && <p className="text-[12px] text-[#8d8a85] mt-1">{hint}</p>}
      </div>
      {cta && (
        <ButtonLink href={cta.href} size="sm">
          {cta.label}
        </ButtonLink>
      )}
    </div>
  );
}
