"use client";

import { useActionState } from "react";
import { updatePassword } from "../login/actions";

const initial = { error: undefined as string | undefined, info: undefined as string | undefined };

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initial);

  return (
    <form action={formAction} className="w-full flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">Nowe hasło</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-3 text-base focus:outline-none focus:border-accent"
        />
      </label>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-white py-3 font-medium active:opacity-80 disabled:opacity-50"
      >
        {pending ? "Czekaj..." : "Ustaw nowe hasło"}
      </button>
    </form>
  );
}
