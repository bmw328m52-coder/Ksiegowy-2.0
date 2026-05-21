"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ActiveTimerHomeCard({
  jobId,
  jobTitle,
  phaseLabel,
  startedAt,
}: {
  jobId: string;
  jobTitle: string;
  phaseLabel: string;
  startedAt: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, now - new Date(startedAt).getTime());
  const totalSec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <Link
      href={`/jobs/${jobId}`}
      className="block rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 active:opacity-80"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Trwa: {phaseLabel}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-900">
            {pad(h)}:{pad(m)}:{pad(s)}
          </p>
          <p className="text-xs text-emerald-800 truncate mt-0.5">{jobTitle}</p>
        </div>
        <span className="text-[11px] text-emerald-700 font-medium shrink-0">
          Przejdź →
        </span>
      </div>
    </Link>
  );
}
