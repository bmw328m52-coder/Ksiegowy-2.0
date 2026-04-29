"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";

const initial = { error: undefined as string | undefined, info: undefined as string | undefined };

export default function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const action = mode === "in" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="w-full flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">E-mail</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className="rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-3 text-base focus:outline-none focus:border-[#282624]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">Hasło</span>
        <input
          name="password"
          type="password"
          required
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          minLength={8}
          className="rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-3 text-base focus:outline-none focus:border-[#282624]"
        />
      </label>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      {state.info && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {state.info}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#282624] text-white py-3 font-medium active:opacity-80 disabled:opacity-50"
      >
        {pending ? "Czekaj..." : mode === "in" ? "Zaloguj się" : "Załóż konto"}
      </button>

      <button
        type="button"
        onClick={() => setMode((m) => (m === "in" ? "up" : "in"))}
        className="text-sm text-zinc-600 underline-offset-2 hover:underline"
      >
        {mode === "in" ? "Pierwsze logowanie? Załóż konto" : "Masz już konto? Zaloguj się"}
      </button>
    </form>
  );
}
