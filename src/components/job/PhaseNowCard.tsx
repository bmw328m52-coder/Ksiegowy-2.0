import Link from "next/link";
import type { ReactNode } from "react";
import { getPhaseCard } from "@/lib/jobPhaseTasks";
import type { PhaseContext, PhaseTask } from "@/lib/jobPhases";

function Row({
  task,
  next,
}: {
  task: PhaseTask;
  next: boolean;
}) {
  const done = task.state === "done";
  const rowCls = [
    "flex min-h-12 items-center gap-3 border-t border-[var(--border)] py-2 text-[14.5px] tabular-nums",
    done
      ? "font-medium text-[var(--muted)]"
      : next
        ? "font-semibold text-[var(--foreground)]"
        : "font-medium text-[var(--foreground)]/70",
  ].join(" ");

  const circle = (
    <span
      aria-hidden="true"
      className={[
        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 text-xs text-white",
        done
          ? "border-[var(--ok)] bg-[var(--ok)]"
          : next
            ? "border-[var(--accent)]"
            : "border-[var(--border)]",
      ].join(" ")}
    >
      {done ? "✓" : ""}
    </span>
  );

  const right: ReactNode = done ? (
    task.meta ? (
      <span className="ml-auto text-[13px] font-medium text-[var(--muted)]">{task.meta}</span>
    ) : null
  ) : task.actionLabel ? (
    <span className="ml-auto text-[13px] font-bold text-[var(--accent)]">{task.actionLabel}</span>
  ) : task.meta ? (
    <span className="ml-auto text-[13px] font-medium text-[var(--muted)]">{task.meta}</span>
  ) : null;

  const inner = (
    <>
      {circle}
      <span>{task.label}</span>
      {right}
      {done ? <span className="sr-only">(zrobione)</span> : null}
    </>
  );

  if (task.href) {
    if (task.href.startsWith("/")) {
      return (
        <Link href={task.href} className={rowCls}>
          {inner}
        </Link>
      );
    }
    return (
      <a href={task.href} className={rowCls}>
        {inner}
      </a>
    );
  }
  return <div className={rowCls}>{inner}</div>;
}

export default function PhaseNowCard({ ctx }: { ctx: PhaseContext }) {
  const card = getPhaseCard(ctx);
  if (!card) return null;
  const nextKey = card.tasks.find((t) => t.state === "todo")?.key;

  return (
    <section className="mb-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-[17px] font-bold tracking-tight text-[var(--foreground)]">{card.title}</h2>
      {card.lead ? (
        <p className="mt-[3px] text-[13.5px] leading-[1.45] text-[var(--muted)]">{card.lead}</p>
      ) : null}
      <div className={card.lead ? "mt-3" : "mt-2"}>
        {card.tasks.map((t) => (
          <Row key={t.key} task={t} next={t.key === nextKey} />
        ))}
      </div>
    </section>
  );
}
