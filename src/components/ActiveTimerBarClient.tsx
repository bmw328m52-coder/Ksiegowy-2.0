"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { stopAnyActiveTimerAction } from "@/app/timerGlobalActions";

type Props = {
  jobId: string;
  jobTitle: string;
  phaseLabel: string;
  startedAt: string;
};

export default function ActiveTimerBarClient({ jobId, jobTitle, phaseLabel, startedAt }: Props) {
  const pathname = usePathname();
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (pathname.startsWith("/login")) return null;

  const elapsedSec = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(elapsedSec / 3600);
  const m = Math.floor((elapsedSec % 3600) / 60);
  const s = elapsedSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  const handleStop = () => {
    startTransition(async () => {
      await stopAnyActiveTimerAction();
    });
  };

  return (
    <div
      className="fixed left-0 right-0 z-50 bg-emerald-700 text-white"
      style={{
        bottom: "calc(64px + env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-md mx-auto flex items-center gap-2 px-3 py-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
        <Link href={`/jobs/${jobId}`} className="min-w-0 flex-1 active:opacity-80">
          <p className="text-[11px] uppercase tracking-wide font-semibold truncate">
            {phaseLabel} · {jobTitle}
          </p>
          <p className="text-base font-bold tabular-nums leading-tight">
            {pad(h)}:{pad(m)}:{pad(s)}
          </p>
        </Link>
        <button
          type="button"
          onClick={handleStop}
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium active:opacity-80 disabled:opacity-50"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
