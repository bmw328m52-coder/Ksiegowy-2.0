"use client";

import { useActionState } from "react";
import { ZIMEX_STARTER } from "./zimex_starter";
import { importZimexMaterialsAction } from "./actions";

export default function ImportZimexButton() {
  const [state, formAction, pending] = useActionState(importZimexMaterialsAction, {});

  return (
    <form action={formAction} className="rounded-xl border border-dashed border-accent/40 bg-accent-soft/40 p-3 flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-foreground">Materiały Zimex (płyty, blaty, obrzeża)</p>
        <p className="text-xs text-muted">
          Dodaje {ZIMEX_STARTER.length} pozycji materiału (płyta biała/dekor, HDF, blat,
          oklejanie) z kategoriami wpiętymi pod „Korpusy" i „Blat" w wycenie. Pomija to, co
          już masz. Ceny to wartości wyjściowe — popraw je w cenniku.
        </p>
      </div>
      {state.message && (
        <p className="text-xs text-ok bg-ok-soft border border-ok/30 rounded-md px-2 py-1">
          {state.message}
        </p>
      )}
      {state.error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-accent text-accent py-2 text-sm font-medium active:bg-accent/10 disabled:opacity-50"
      >
        {pending ? "Dodaję..." : "Dodaj materiały Zimex do cennika"}
      </button>
    </form>
  );
}
