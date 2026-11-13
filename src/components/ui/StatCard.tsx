import Link from "next/link";
import { Money } from "@/components/Money";

type Tone = "neutral" | "accent" | "ok" | "warn" | "info";

const VALUE_TONE: Record<Tone, string> = {
  neutral: "text-[#1f1d1b]",
  accent: "text-[#a06f3f]",
  ok: "text-[#4f8a64]",
  warn: "text-[#b8523a]",
  info: "text-[#5a7898]",
};

const BAR_TONE: Record<Tone, string> = {
  neutral: "bg-[#c9c7c2]",
  accent: "bg-[#a06f3f]",
  ok: "bg-[#4f8a64]",
  warn: "bg-[#b8523a]",
  info: "bg-[#5a7898]",
};

/**
 * Kafel statystyki: etykieta + duża wartość (liczba i/lub kwota) + podpowiedź.
 * Kwoty renderowane przez <Money>, więc respektują tryb prywatny (blur).
 * Podaj `href`, by kafel był klikalny; `money` gdy wartość to kwota do ukrycia.
 */
export default function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  money = false,
  hintMoney = false,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  href?: string;
  money?: boolean;
  /** Podpowiedź zawiera kwotę — też ukrywana w trybie prywatnym. */
  hintMoney?: boolean;
  /** Większy, wyróżniony kafel (np. kluczowa metryka) */
  emphasis?: boolean;
}) {
  const valueSize = "leading-none";
  // Rozmiar liczby dopasowuje się do szerokości kafla (container query), żeby duże kwoty się nie ucinały:
  // ok. 0,62 em na znak; maksimum jak dotąd (24 px, w wyróżnionym kaflu 30 px).
  const chars = Math.max(String(value).length, 6);
  const maxPx = emphasis ? 30 : 24;
  const valueFont = `clamp(14px, calc(100cqw / ${(chars * 0.62).toFixed(2)}), ${maxPx}px)`;
  const inner = (
    <>
      <span
        aria-hidden
        className={`absolute top-0 left-0 right-0 h-[3px] ${BAR_TONE[tone]}`}
      />
      <p className="text-[10px] uppercase tracking-[0.06em] font-semibold text-[#9ea29c] truncate">
        {label}
      </p>
      <div className="mt-1.5" style={{ fontSize: valueFont }}>
        {money ? (
          <Money className={`${valueSize} font-bold tabular-nums ${VALUE_TONE[tone]}`}>
            {value}
          </Money>
        ) : (
          <span className={`${valueSize} font-bold tabular-nums ${VALUE_TONE[tone]}`}>
            {value}
          </span>
        )}
      </div>
      {hint &&
        (hintMoney ? (
          <Money as="p" className="text-[10px] text-[#9ea29c] mt-1 truncate">
            {hint}
          </Money>
        ) : (
          <p className="text-[10px] text-[#9ea29c] mt-1 truncate">{hint}</p>
        ))}
    </>
  );

  const base =
    "relative overflow-hidden [container-type:inline-size] rounded-2xl border border-[#ededea] bg-white p-3.5 shadow-[0_1px_2px_rgba(40,38,36,0.04)]";

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} block transition-colors hover:border-[#d8d7d3] active:bg-[#f6f6f5]`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}
