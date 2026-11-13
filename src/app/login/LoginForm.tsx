"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, requestPasswordReset } from "./actions";

const initial = { error: undefined as string | undefined, info: undefined as string | undefined };

type Mode = "in" | "up" | "reset";

export default function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("in");
  const action = mode === "in" ? signIn : mode === "up" ? signUp : requestPasswordReset;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="w-full flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-[var(--muted)]">E-mail</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] px-3 min-h-12 py-3 text-base focus:outline-none focus:border-[var(--accent)]"
        />
      </label>

      {mode !== "reset" && (
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-[var(--muted)]">Hasło</span>
          <input
            name="password"
            type="password"
            required
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            minLength={8}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] px-3 min-h-12 py-3 text-base focus:outline-none focus:border-[var(--accent)]"
          />
        </label>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-[var(--warn)] bg-[var(--warn-soft)] border border-[var(--warn)] rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      {state.info && (
        <p role="status" className="text-sm text-[var(--ok)] bg-[var(--ok-soft)] border border-[var(--ok)] rounded-md px-3 py-2">
          {state.info}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--accent)] text-[var(--btn-fg)] min-h-12 py-3 text-base font-semibold active:opacity-80 disabled:opacity-50"
      >
        {pending
          ? "Czekaj..."
          : mode === "in"
            ? "Zaloguj się"
            : mode === "up"
              ? "Załóż konto"
              : "Wyślij link do zmiany hasła"}
      </button>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setMode((m) => (m === "in" ? "up" : "in"))}
          className="text-sm text-[var(--muted)] underline underline-offset-2 min-h-11 px-2 hover:text-[var(--foreground)]"
        >
          {mode === "up" ? "Masz już konto? Zaloguj się" : "Pierwsze logowanie? Załóż konto"}
        </button>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "reset" ? "in" : "reset"))}
          className="text-sm text-[var(--muted)] underline underline-offset-2 min-h-11 px-2 hover:text-[var(--foreground)]"
        >
          {mode === "reset" ? "Wróć do logowania" : "Nie pamiętam hasła"}
        </button>
      </div>
    </form>
  );
}
