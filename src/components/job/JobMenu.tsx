"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import type { JobStatus } from "@/lib/dao/jobs.types";

type ServerAction = () => void | Promise<void>;

const ITEM =
  "flex w-full min-h-[48px] items-center px-4 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent,#a06f3f)]";

export default function JobMenu({
  jobId,
  status,
  cancelAction,
  uncancelAction,
  deleteAction,
}: {
  jobId: string;
  status: JobStatus;
  cancelAction: ServerAction;
  uncancelAction: ServerAction;
  deleteAction: ServerAction;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const canCancel =
    status !== "cancelled" && status !== "settled" && status !== "archived";
  const isCancelled = status === "cancelled";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Zamknięcie po wyborze pozycji. Formularze zostają zamontowane (panel
  // tylko chowany CSS-em), więc submit się nie gubi. Gdy użytkownik odrzuci
  // confirm(), ConfirmSubmitButton robi preventDefault — wtedy panel zostaje.
  const closeAfterClick = (e: MouseEvent) => {
    if (!e.defaultPrevented) setOpen(false);
  };

  // Tab poza menu (fokus wychodzi z kontenera) zamyka panel.
  const onBlur = (e: FormEvent<HTMLDivElement>) => {
    const next = (e.nativeEvent as FocusEvent).relatedTarget as Node | null;
    if (open && next && rootRef.current && !rootRef.current.contains(next)) {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative" onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Więcej akcji"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--foreground)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent,#a06f3f)]"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      <div
        id={panelId}
        role="group"
        aria-label="Akcje zlecenia"
        className={`${
          open ? "flex" : "hidden"
        } absolute right-0 top-full z-50 mt-1 w-64 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-lg`}
      >
        <Link
          href={`/jobs/${jobId}/edit`}
          onClick={() => setOpen(false)}
          className={ITEM}
        >
          Edytuj zlecenie
        </Link>

        {canCancel && (
          <form action={cancelAction} onClick={closeAfterClick}>
            <ConfirmSubmitButton
              message="Anulować to zlecenie? Status zmieni się na „Anulowane”. Można to później cofnąć."
              formNoValidate
              className={ITEM}
            >
              Anuluj zlecenie
            </ConfirmSubmitButton>
          </form>
        )}

        {isCancelled && (
          <form action={uncancelAction} onClick={closeAfterClick}>
            <button type="submit" className={ITEM}>
              Przywróć zlecenie
            </button>
          </form>
        )}

        <div className="my-1 border-t border-[var(--border)]" />

        <form action={deleteAction} onClick={closeAfterClick}>
          <ConfirmSubmitButton
            message="Na pewno usunąć to zlecenie? Tej operacji nie da się cofnąć."
            formNoValidate
            className={`${ITEM} !text-[var(--warn)]`}
          >
            Usuń zlecenie
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
