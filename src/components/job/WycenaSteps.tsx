import Link from "next/link";

/**
 * Wycena zlecenia to dwa kolejne kroki w jednym wejściu:
 *  1. Pozycje i materiały (/jobs/{id}/wycena) — składa koszty,
 *  2. Cena i rentowność (/calculator?job={id}) — z kosztów liczy cenę, marżę i zapisuje wynik w zleceniu.
 * Pasek jest pokazywany na obu ekranach, więc nie trzeba zgadywać, co kliknąć dalej.
 */
export default function WycenaSteps({ jobId, current }: { jobId: string; current: 1 | 2 }) {
  const steps = [
    { n: 1 as const, label: "Pozycje i materiały", href: `/jobs/${jobId}/wycena` },
    { n: 2 as const, label: "Cena i rentowność", href: `/calculator?job=${jobId}` },
  ];
  return (
    <nav aria-label="Kroki wyceny" className="mb-4">
      <ol className="grid grid-cols-2 gap-2">
        {steps.map((s) => {
          const active = s.n === current;
          return (
            <li key={s.n}>
              <Link
                href={s.href}
                aria-current={active ? "step" : undefined}
                className={[
                  "flex min-h-[52px] items-center gap-2.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-2)] active:bg-[var(--surface-2)]",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold",
                    active ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--muted)]",
                  ].join(" ")}
                >
                  {s.n}
                </span>
                <span className="leading-tight">{s.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
