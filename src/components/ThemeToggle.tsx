"use client";

import { useTheme, type Theme } from "@/components/AppAppearance";

const OPTIONS: { value: Theme; label: string; hint: string }[] = [
  { value: "light", label: "Jasny", hint: "ciepłe tło, białe karty" },
  { value: "dark", label: "Grafit", hint: "ciemny grafit, szampańskie akcenty" },
];

/** Przełącznik wyglądu aplikacji; wybór zapamiętywany w tej przeglądarce. */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <section aria-labelledby="theme-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 id="theme-heading" className="text-sm font-semibold text-[var(--accent)]">
        Wygląd aplikacji
      </h2>
      <div role="radiogroup" aria-labelledby="theme-heading" className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const on = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTheme(o.value)}
              className={`min-h-14 rounded-xl border px-3 py-2 text-left transition-colors ${
                on
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)]"
              }`}
            >
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-[var(--muted)]">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
