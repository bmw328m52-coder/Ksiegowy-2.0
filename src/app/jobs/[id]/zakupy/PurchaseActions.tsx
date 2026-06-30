"use client";

import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // Fallback dla starszych WebView — zaznacz przez prompt.
      window.prompt("Skopiuj listę:", text);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="print:hidden text-xs font-medium text-accent px-2 py-1 rounded-md active:bg-accent/10"
    >
      {done ? "Skopiowano ✓" : (label ?? "Kopiuj")}
    </button>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 active:bg-zinc-50"
    >
      Drukuj / PDF
    </button>
  );
}
