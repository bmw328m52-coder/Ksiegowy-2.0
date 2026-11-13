"use client";

import { useActionState } from "react";
import { updatePassword } from "../login/actions";

const initial = { error: undefined as string | undefined, info: undefined as string | undefined };

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initial);

  return (
    <form action={formAction} className="w-full flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-[var(--muted)]">Nowe hasło</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] px-3 min-h-12 py-3 text-base focus:outline-none focus:border-[var(--accent)]"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-[var(--warn)] bg-[var(--warn-soft)] border border-[var(--warn)] rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--accent)] text-[var(--btn-fg)] min-h-12 py-3 text-base font-semibold active:opacity-80 disabled:opacity-50"
      >
        {pending ? "Czekaj..." : "Ustaw nowe hasło"}
      </button>
    </form>
  );
}
