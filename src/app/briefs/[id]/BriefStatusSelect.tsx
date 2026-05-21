"use client";

import { useTransition } from "react";
import {
  QUOTE_BRIEF_STATUSES,
  QUOTE_BRIEF_STATUS_LABELS,
  type QuoteBriefStatus,
} from "@/lib/dao/quote_briefs.types";
import { setBriefStatusAction } from "../actions";

export default function BriefStatusSelect({
  briefId,
  current,
}: {
  briefId: string;
  current: QuoteBriefStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500 shrink-0">Status:</span>
      <select
        defaultValue={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as QuoteBriefStatus;
          const fd = new FormData();
          fd.set("status", next);
          startTransition(async () => {
            await setBriefStatusAction(briefId, fd);
          });
        }}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
      >
        {QUOTE_BRIEF_STATUSES.map((s) => (
          <option key={s} value={s}>
            {QUOTE_BRIEF_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
