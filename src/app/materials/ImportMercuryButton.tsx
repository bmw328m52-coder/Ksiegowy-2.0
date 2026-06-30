"use client";

import { useActionState } from "react";
import { MERCURY_STARTER } from "./mercury_starter";
import { syncMercuryCatalogAction } from "./actions";

export default function ImportMercuryButton() {
  const [state, formAction, pending] = useActionState(syncMercuryCatalogAction, {});

  return (
    <form action={formAction} className="rounded-xl border border-dashed border-accent/40 bg-accent-soft/40 p-3 flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-foreground">Cennik Mercury (Merkury AM)</p>
        <p className="text-xs text-muted">
          Synchronizuje {MERCURY_STARTER.length} pozycji ze źródłem: dodaje nowe, aktualizuje
          ceny i usuwa nieaktualne wpisy (np. po zmianie nazwy). Pozycje oznaczone dostawcą
          „Mercury" są w całości zarządzane tym cennikiem.
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
        {pending ? "Synchronizuję..." : "Synchronizuj cennik Mercury"}
      </button>
    </form>
  );
}
