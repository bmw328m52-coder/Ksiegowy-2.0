"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { KsefStatus } from "@/lib/dao/ksef";
import { syncKsefAction, type KsefActionState } from "@/app/settings/ksef/actions";

function ago(iso: string | null): string {
  if (!iso) return "jeszcze nie pobierano";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} godz. temu`;
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export default function KsefSyncCard({ status }: { status: KsefStatus | null }) {
  const [state, action, pending] = useActionState<KsefActionState>(syncKsefAction, {});

  if (!status) {
    return (
      <Link
        href="/settings#ksef"
        className="flex items-center gap-3 rounded-2xl border border-[#e2c79c] bg-[linear-gradient(160deg,#fbf1dd_0%,#fff8e9_100%)] p-3.5 active:opacity-80"
      >
        <KsefBadge />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1f1d1b]">Podłącz KSeF</p>
          <p className="text-xs text-[#6f6c66]">Faktury od dostawców wpadną same — bez skanowania.</p>
        </div>
        <span className="text-[#a06f3f] text-lg">›</span>
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-[#ededea] bg-white p-3.5 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <KsefBadge />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1f1d1b]">KSeF</p>
          <p className="text-xs text-[#6f6c66]">Ostatnio: {ago(status.last_sync_at)}</p>
        </div>
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg text-white text-[13px] font-semibold px-3 py-1.5 bg-[linear-gradient(160deg,#a06f3f,#7d5530)] disabled:opacity-60"
          >
            {pending ? "Pobieram…" : "Pobierz z KSeF"}
          </button>
        </form>
      </div>
      {pending && <p className="text-xs text-[#6f6c66]">Loguję się do KSeF i sprawdzam nowe faktury — kilka sekund.</p>}
      {!pending && state.ok && (
        <p className="text-xs text-[#3a6b4d] bg-[#e3efe5] border border-[#cfe4d4] rounded-md px-2.5 py-1.5">{state.ok}</p>
      )}
      {!pending && (state.error || (!state.ok && status.last_error)) && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
          {state.error ?? status.last_error}
        </p>
      )}
    </div>
  );
}

function KsefBadge() {
  return (
    <div className="w-9 h-9 shrink-0 rounded-lg bg-[#282624] text-white text-[10px] font-bold flex items-center justify-center tracking-tight">
      KSeF
    </div>
  );
}
