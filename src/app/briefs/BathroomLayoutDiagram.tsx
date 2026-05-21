"use client";

import { useEffect, useRef, useState } from "react";

type Layout = "lin" | "l" | "u" | "wneka";

const WALL = "#282624";
const ROOM = "#fafaf9";

export default function BathroomLayoutDiagram({
  initialLayout = "lin",
}: {
  initialLayout?: Layout;
}) {
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const sel = form.querySelector<HTMLInputElement>(
        'input[name="data.room_layout"]:checked'
      );
      if (
        sel &&
        (sel.value === "lin" ||
          sel.value === "l" ||
          sel.value === "u" ||
          sel.value === "wneka")
      ) {
        setLayout(sel.value as Layout);
      }
    };
    sync();
    form.addEventListener("change", sync);
    return () => form.removeEventListener("change", sync);
  }, []);

  const showB = layout === "l" || layout === "u" || layout === "wneka";
  const showC = layout === "u" || layout === "wneka";
  const shortAC = layout === "wneka";
  const wallAH = shortAC ? 48 : 136;
  const wallCH = shortAC ? 48 : 136;

  return (
    <div ref={ref} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-[11px] text-zinc-500 mb-2 text-center">
        Układ pomieszczenia (widok z góry)
      </p>
      <svg viewBox="0 0 200 160" className="w-full max-w-[280px] mx-auto block">
        <rect x="22" y="22" width="156" height="116" fill={ROOM} stroke="#e4e4e7" />

        {/* Wall A — left */}
        <rect x="12" y="12" width="14" height={wallAH} fill={WALL} />
        <text
          x="19"
          y={12 + wallAH / 2 + 4}
          textAnchor="middle"
          fill="#fff"
          fontSize="10"
          fontWeight="700"
        >
          A
        </text>

        {/* Wall B — top */}
        {showB && (
          <>
            <rect
              x="26"
              y="12"
              width={showC ? 148 : 162}
              height="14"
              fill={WALL}
            />
            <text
              x={showC ? 100 : 107}
              y="22"
              textAnchor="middle"
              fill="#fff"
              fontSize="10"
              fontWeight="700"
            >
              B
            </text>
          </>
        )}

        {/* Wall C — right */}
        {showC && (
          <>
            <rect x="174" y="12" width="14" height={wallCH} fill={WALL} />
            <text
              x="181"
              y={12 + wallCH / 2 + 4}
              textAnchor="middle"
              fill="#fff"
              fontSize="10"
              fontWeight="700"
            >
              C
            </text>
          </>
        )}

        {shortAC && (
          <>
            <text x="34" y="46" fill="#71717a" fontSize="6">~600</text>
            <text x="155" y="46" fill="#71717a" fontSize="6">~600</text>
          </>
        )}
      </svg>
      <p className="text-[11px] text-center text-zinc-600 mt-2">
        {layout === "lin" && "Prosta ściana"}
        {layout === "l" && "Litera L"}
        {layout === "u" && "Litera U"}
        {layout === "wneka" && "Wnęka (środkowa + 2 boczne ~600 mm)"}
      </p>
    </div>
  );
}
