"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { applyAutopriceAction } from "./actions";

export default function RecalcAutopriceButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await applyAutopriceAction(jobId);
      if (res.error) {
        setError(res.error);
        return;
      }
      const r = res.result;
      if (r && r.created + r.updated + r.removed > 0) {
        const parts: string[] = [];
        if (r.created) parts.push(`dodano ${r.created}`);
        if (r.updated) parts.push(`zaktualizowano ${r.updated}`);
        if (r.removed) parts.push(`usunięto ${r.removed}`);
        setMsg(`Auto-wycena: ${parts.join(", ")}.`);
      } else {
        setMsg("Brak pozycji do wyceny — uzupełnij ilości i domyślne ceny.");
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 mb-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-lg bg-accent text-white px-3 py-2 text-sm font-medium active:opacity-80 disabled:opacity-50"
        >
          {pending ? "Liczę…" : "Przelicz z pomiaru"}
        </button>
        <Link
          href="/auto-wycena"
          className="text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          Domyślne ceny ⚙
        </Link>
      </div>
      {msg && <p className="text-xs text-zinc-600 mt-2">{msg}</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-[11px] text-zinc-400 mt-2">
        Wycenia ilości z pomiaru (lakier, blat, LED) i rozpiskę zawiasów/siłowników wg domyślnych cen.
        Pozycje dodane ręcznie zostają nietknięte.
      </p>
    </div>
  );
}
