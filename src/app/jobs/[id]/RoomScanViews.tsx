"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ScanData } from "@/lib/dao/room_scans.types";
import RoomScanPlan from "./RoomScanPlan";

// three.js ładujemy dopiero po kliknięciu „3D" — nie obciąża strony zlecenia.
const RoomScan3D = dynamic(() => import("./RoomScan3D"), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-lg bg-[#f4f2ee]" />,
});

export default function RoomScanViews({ data }: { data: ScanData }) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-lg border border-[#ededea] p-0.5 text-xs">
        {(["2d", "3d"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 font-medium ${mode === m ? "bg-[#282624] text-white" : "text-zinc-600"}`}
          >
            {m === "2d" ? "Rzut 2D" : "Widok 3D"}
          </button>
        ))}
      </div>
      {mode === "2d" ? <RoomScanPlan data={data} /> : <RoomScan3D data={data} />}
    </div>
  );
}
