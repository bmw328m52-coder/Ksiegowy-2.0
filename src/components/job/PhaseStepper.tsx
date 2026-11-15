import type { JobStatus } from "@/lib/dao/jobs.types";
import { PHASES, phaseOfStatus, phaseIndex, isJobClosed } from "@/lib/jobPhases";

/** Pasek 5 faz zlecenia (warstwa prezentacji nad statusami). */
export default function PhaseStepper({ status }: { status: JobStatus }) {
  const phase = phaseOfStatus(status);

  if (phase === null) {
    return (
      <div className="mb-4">
        <span className="inline-block rounded-full bg-[var(--border)] px-2.5 py-0.5 text-xs font-bold text-[var(--muted)]">
          Anulowane
        </span>
      </div>
    );
  }

  const closed = isJobClosed(status);
  const current = phaseIndex(phase);

  return (
    <ol aria-label="Etapy zlecenia" className="mb-4 flex items-start">
      {PHASES.map((p, i) => {
        const state: "done" | "cur" | "next" = closed || i < current ? "done" : i === current ? "cur" : "next";
        const lineActive = state !== "next";
        return (
          <li
            key={p.key}
            aria-current={state === "cur" ? "step" : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-[5px] text-center text-[11px] font-semibold leading-tight min-[360px]:text-[11.5px] ${
              state === "cur" ? "text-[var(--foreground)]" : "text-[var(--muted)]"
            }`}
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute left-[-50%] top-[13px] z-0 h-[2px] w-full ${
                  lineActive ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}
              />
            )}
            <span
              aria-hidden="true"
              className={`z-10 grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                state === "done"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : state === "cur"
                    ? "border-[var(--accent)] bg-white text-[var(--accent)] shadow-[0_0_0_4px_var(--accent-soft)]"
                    : "border-[var(--border)] bg-white"
              }`}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span className="max-w-full break-words px-0.5">{p.label}</span>
            <span className="sr-only">
              {state === "done" ? "zakończony" : state === "cur" ? "bieżący" : "następny"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
