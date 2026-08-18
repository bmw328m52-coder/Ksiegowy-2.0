import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "ok" | "warn" | "info";

const TONE: Record<Tone, string> = {
  neutral: "bg-[#f0f0ee] text-[#6f6c66] border-[#e6e5e2]",
  accent: "bg-[#f1e5d2] text-[#a06f3f] border-[#e7d3b3]",
  ok: "bg-[#e3efe5] text-[#4f8a64] border-[#cfe4d4]",
  warn: "bg-[#f4e0d9] text-[#b8523a] border-[#ecccc0]",
  info: "bg-[#dde5ef] text-[#5a7898] border-[#cdd9e7]",
};

/** Mała etykieta statusu/etapu. Spójny wygląd dla wszystkich stanów zleceń, faktur itd. */
export default function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONE[tone]}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}
