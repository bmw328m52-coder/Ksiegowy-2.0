"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Poziomy, przewijany palcem pas miesięcy. Każdy panel = jeden miesiąc na całą szerokość
 * (scroll-snap). Nad panelami pasek skrótów Sty…Gru, który podąża za przewijaniem.
 */
export default function MonthCarousel({
  labels,
  initial,
  markers,
  children,
}: {
  labels: string[];
  initial: number;
  /** Małe oznaczenie pod nazwą miesiąca (np. „dziś”). */
  markers?: Record<number, string>;
  children: ReactNode[];
}) {
  const track = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(initial);
  const raf = useRef(0);

  const goTo = useCallback((i: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Start od bieżącego miesiąca (bez animacji).
  useEffect(() => {
    goTo(initial, false);
  }, [initial, goTo]);

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = track.current;
      if (!el || el.clientWidth === 0) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setActive((prev) => (prev === i ? prev : i));
    });
  };

  // Aktywny skrót ma być widoczny w pasku skrótów.
  useEffect(() => {
    const bar = chips.current;
    const chip = bar?.children[active] as HTMLElement | undefined;
    if (!bar || !chip) return;
    bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  return (
    <div className="ld-carousel">
      <div className="ld-chips-row">
        <button
          type="button"
          aria-label="Poprzedni miesiąc"
          className="ld-arrow"
          disabled={active === 0}
          onClick={() => goTo(active - 1)}
        >
          ‹
        </button>
        <div ref={chips} className="ld-chips" role="tablist" aria-label="Miesiące">
          {labels.map((l, i) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={active === i}
              data-on={active === i}
              className="ld-chip"
              onClick={() => goTo(i)}
            >
              {l}
              {markers?.[i] && <small>{markers[i]}</small>}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Następny miesiąc"
          className="ld-arrow"
          disabled={active === labels.length - 1}
          onClick={() => goTo(active + 1)}
        >
          ›
        </button>
      </div>

      <div ref={track} className="ld-track" onScroll={onScroll}>
        {children.map((c, i) => (
          <div key={i} className="ld-slide" aria-hidden={active !== i}>
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}
