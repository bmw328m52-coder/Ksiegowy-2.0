"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { avatarTone, clientInitials } from "@/lib/avatar";

type ClientLite = { id: string; name: string; phone: string | null };

export default function ClientPicker({ clients }: { clients: ClientLite[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) =>
      [c.name, c.phone ?? ""].join(" ").toLowerCase().includes(needle),
    );
  }, [q, clients]);

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/clients/new?next=job"
        className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-[14px] font-bold text-white shadow-[0_6px_14px_rgba(40,38,36,.25)]"
        style={{ background: "linear-gradient(160deg, #57534e, #3a3633)" }}
      >
        <span className="flex items-center gap-2">
          <span className="text-[18px] leading-none">+</span>
          Nowy klient
        </span>
        <span aria-hidden>→</span>
      </Link>

      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj istniejącego klienta…"
          className="w-full rounded-xl border border-[#e6dcc7] bg-white pl-10 pr-3 py-3 text-[14px] focus:outline-none focus:border-[#57534e]"
          autoFocus
        />
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9c9081]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d8d2c8] bg-white/60 px-4 py-6 text-center">
          <p className="text-[13px] font-medium text-[#6b6661]">
            {q ? "Brak wyników" : "Nie masz jeszcze klientów"}
          </p>
          <p className="text-[11px] text-[#9c9081] mt-1">
            Dodaj nowego klienta przyciskiem powyżej
          </p>
        </div>
      ) : (
        <ul className="rounded-xl border border-[#e6dcc7] bg-white divide-y divide-[#f0ece5] overflow-hidden">
          {filtered.map((c) => {
            const tone = avatarTone(c.name);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/jobs/new?clientId=${c.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-[#faf7f2] hover:bg-[#faf7f2]"
                >
                  <span
                    className="inline-flex w-9 h-9 rounded-full items-center justify-center text-[13px] font-bold shrink-0"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {clientInitials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-[#282624] truncate">
                      {c.name}
                    </span>
                    {c.phone && (
                      <span className="block text-[11px] text-[#9c9081] truncate mt-0.5">
                        {c.phone}
                      </span>
                    )}
                  </span>
                  <span className="text-[#c4bbac] shrink-0" aria-hidden>→</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
