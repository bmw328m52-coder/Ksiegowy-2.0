"use client";

import { useActionState, useState } from "react";
import type { KsefStatus } from "@/lib/dao/ksef";
import { connectKsefAction, disconnectKsefAction, type KsefActionState } from "./actions";

const inputCls =
  "rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-3 text-base focus:outline-none focus:border-accent w-full";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });
}

export default function KsefSettings({
  status,
  defaultNip,
  defaultSyncFrom,
}: {
  status: KsefStatus | null;
  defaultNip: string | null;
  defaultSyncFrom: string;
}) {
  const [editing, setEditing] = useState(status === null);
  const [state, formAction, pending] = useActionState<KsefActionState, FormData>(connectKsefAction, {});

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">KSeF — faktury kosztowe</h2>

      {status && !editing && (
        <div className="rounded-lg border border-[#ededea] bg-[#faf9f7] p-3.5 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Status</span>
            <span className="font-semibold text-[#3a6b4d]">● Połączono</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">NIP</span>
            <span className="font-medium text-[#1f1d1b] tabular-nums">{status.nip}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Ostatnie pobranie</span>
            <span className="font-medium text-[#1f1d1b]">
              {fmtDateTime(status.last_sync_at)}
              {status.last_sync_added ? ` · +${status.last_sync_added}` : ""}
            </span>
          </div>
          {status.last_error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
              {status.last_error}
            </p>
          )}
          <p className="text-[11px] text-zinc-500">
            Nowe faktury pobierają się same codziennie rano. Ręcznie: Faktury → „Pobierz z KSeF”.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 rounded-lg bg-white border border-[#ededea] text-[13px] font-semibold py-2 active:bg-[#f6f6f5]"
            >
              Zmień token
            </button>
            <form action={disconnectKsefAction} className="flex-1">
              <button
                type="submit"
                onClick={(e) => {
                  if (!confirm("Odłączyć KSeF? Pobrane faktury zostaną w aplikacji.")) e.preventDefault();
                }}
                className="w-full rounded-lg bg-white border border-[#ecccc0] text-[#b8523a] text-[13px] font-semibold py-2 active:bg-[#fdf4f1]"
              >
                Odłącz
              </button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <form action={formAction} className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">
            Token wygenerujesz w Aplikacji Podatnika KSeF z uprawnieniem <b>przeglądanie faktur</b>. Aplikacja
            zapisuje go zaszyfrowanego i używa tylko do odczytu faktur, na których jesteś nabywcą.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Token KSeF</span>
            <textarea
              name="token"
              required
              rows={3}
              autoComplete="off"
              spellCheck={false}
              placeholder="Wklej token…"
              className={`${inputCls} font-mono text-xs`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">NIP firmy</span>
            <input
              name="nip"
              required
              inputMode="numeric"
              defaultValue={status?.nip ?? defaultNip ?? ""}
              placeholder="10 cyfr"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Pobieraj faktury od</span>
            <input
              name="sync_from"
              type="date"
              required
              defaultValue={status?.sync_from?.slice(0, 10) ?? defaultSyncFrom}
              className={inputCls}
            />
          </label>
          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{state.error}</p>
          )}
          {state.ok && (
            <p className="text-sm text-[#3a6b4d] bg-[#e3efe5] border border-[#cfe4d4] rounded-md px-3 py-2">
              {state.ok}
            </p>
          )}
          <div className="flex gap-2">
            {status && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl bg-white border border-[#ededea] text-[14px] font-semibold py-2.5"
              >
                Anuluj
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl text-white text-[14px] font-semibold py-2.5 bg-[linear-gradient(160deg,#a06f3f,#7d5530)] disabled:opacity-50"
            >
              {pending ? "Sprawdzam połączenie…" : "Połącz z KSeF"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
