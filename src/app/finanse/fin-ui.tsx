import Link from "next/link";
import type { ReactNode } from "react";
import { Money } from "@/components/Money";
import { fmtPLN } from "@/lib/format";
import type { AttentionItem, AttentionSeverity } from "@/lib/dao/finance";
import type { MonthlyPoint } from "@/lib/dao/dashboard";
import type { SegmentItem } from "@/components/ui/SegmentedNav";
import { ButtonLink } from "@/components/ui/Button";
import MonthlyBars from "@/components/MonthlyBars";

/**
 * Elementy interfejsu modułu Finanse w motywie „grafit i szampan”.
 * Odpowiedniki wspólnych komponentów (Card, SegmentedNav, EmptyState, AttentionPanel, wykres roczny),
 * które mają zaszyte jasne kolory — tu wszystkie kolory idą przez zmienne motywu.
 */

type CardTone = "default" | "accent" | "warn" | "muted" | "ok";

const CARD_TONE: Record<CardTone, string> = {
  default: "border-[var(--border)] bg-[var(--surface)]",
  accent: "border-[var(--accent)] bg-[var(--accent-soft)]",
  warn: "border-[var(--warn)] bg-[var(--warn-soft)]",
  ok: "border-[var(--ok)] bg-[var(--ok-soft)]",
  muted: "border-[var(--border)] bg-[var(--surface)]",
};

export function FinCard({
  children,
  className = "",
  tone = "default",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  tone?: CardTone;
  padded?: boolean;
}) {
  return (
    <div className={`rounded-2xl border ${CARD_TONE[tone]} ${padded ? "p-4" : ""} ${className}`}>
      {children}
    </div>
  );
}

/** Poziomy pasek filtrów — linki; aktywny segment wyróżniony szampanem, cel dotyku min. 44 px. */
export function FinSegmentedNav({ items, activeKey }: { items: SegmentItem[]; activeKey: string }) {
  return (
    <nav aria-label="Filtry listy">
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const active = it.key === activeKey;
          const countTone = active
            ? "bg-[var(--background)]/25 text-[var(--background)]"
            : it.tone === "warn"
              ? "bg-[var(--warn-soft)] text-[var(--warn)]"
              : "bg-[var(--surface-2)] text-[var(--muted)]";
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={[
                "shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 min-h-[44px] text-[13px] font-semibold transition-colors",
                active
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]",
              ].join(" ")}
            >
              {it.label}
              {typeof it.count === "number" && (
                <span
                  className={`inline-flex min-w-[20px] justify-center rounded-full px-1.5 text-[12px] tabular-nums ${countTone}`}
                >
                  {it.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const EMPTY_BOX = {
  info: "bg-[var(--info-soft)] text-[var(--info)]",
  ok: "bg-[var(--ok-soft)] text-[var(--ok)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  neutral: "bg-[var(--surface-2)] text-[var(--muted)]",
};

export function FinEmptyState({
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
  tone?: keyof typeof EMPTY_BOX;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center flex flex-col items-center gap-3">
      <span aria-hidden className={`inline-flex w-12 h-12 rounded-2xl items-center justify-center ${EMPTY_BOX[tone]}`}>
        {icon}
      </span>
      <div>
        <p className="text-[15px] font-semibold text-[var(--foreground)]">{title}</p>
        {hint && <p className="text-[13px] text-[var(--muted)] mt-1">{hint}</p>}
      </div>
      {cta && (
        <ButtonLink href={cta.href} size="sm" className="min-h-[44px]">
          {cta.label}
        </ButtonLink>
      )}
    </div>
  );
}

const ATT_TONE: Record<AttentionSeverity, { dot: string; label: string }> = {
  high: { dot: "bg-[var(--warn)]", label: "text-[var(--warn)]" },
  medium: { dot: "bg-[var(--accent)]", label: "text-[var(--accent)]" },
  low: { dot: "bg-[var(--muted)]", label: "text-[var(--foreground)]" },
};

/** Lista „Wymaga uwagi” — kontrastowa w ciemnym motywie. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--ok)] bg-[var(--ok-soft)] px-4 py-5 text-center">
        <p className="text-sm font-semibold text-[var(--ok)]">Wszystko pod kontrolą</p>
        <p className="text-[13px] text-[var(--foreground)] mt-0.5">
          Brak dokumentów i terminów wymagających reakcji.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <header className="px-4 pt-4 pb-2 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-[var(--muted)]">Kontrola</p>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Wymaga uwagi</h2>
        </div>
        <span
          className="text-[12px] font-semibold text-[var(--warn)] bg-[var(--warn-soft)] rounded-full px-2.5 py-0.5"
          aria-label={`Pozycji do sprawdzenia: ${items.length}`}
        >
          {items.length}
        </span>
      </header>
      <ul>
        {items.map((it, i) => {
          const tone = ATT_TONE[it.severity];
          return (
            <li key={`${it.kind}-${i}`} className="border-t border-[var(--border)] first:border-t-0">
              <Link
                href={it.href}
                className="flex items-start gap-3 px-4 py-3 min-h-[56px] hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)] transition-colors"
              >
                <span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${tone.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold break-words ${tone.label}`}>{it.title}</p>
                  <p className="text-[13px] text-[var(--muted)] mt-0.5 break-words">{it.hint}</p>
                </div>
                {it.amount !== null && (
                  <Money className="text-sm font-semibold tabular-nums text-[var(--foreground)] shrink-0">
                    {fmtPLN(it.amount)}
                  </Money>
                )}
                <svg
                  className="mt-1.5 shrink-0 text-[var(--muted)]"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Wykres przychód/koszty netto w skali roku — wspólny, interaktywny komponent. */
export function FinTrendChart({ data, highlightMonth }: { data: MonthlyPoint[]; highlightMonth?: number }) {
  return <MonthlyBars data={data} highlightMonth={highlightMonth} />;
}
