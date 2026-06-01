"use client";

import { useEffect, useRef, useState } from "react";
import { type RoomLayout as Layout, isRoomLayout, wallVisibility } from "./roomLayout";

type Wall = "a" | "b" | "c" | "d";

const WALL = "#282624";
const WALL_ACTIVE = "#fbbf24";
const ROOM = "#fafaf9";
const WINDOW = "#3b82f6";
const WINDOW_BORDER = "#1d4ed8";

function isWall(v: string): v is Wall {
  return v === "a" || v === "b" || v === "c" || v === "d";
}

export default function KitchenLayoutDiagram({
  initialLayout = "u",
  initialWindowWall = "",
  initialHasIsland = false,
  initialIslandRotation = 0,
}: {
  initialLayout?: Layout;
  initialWindowWall?: string;
  initialHasIsland?: boolean;
  initialIslandRotation?: 0 | 90;
}) {
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [hasIsland, setHasIsland] = useState<boolean>(initialHasIsland);
  const [islandRot, setIslandRot] = useState<0 | 90>(initialIslandRotation);
  const [windowWall, setWindowWall] = useState<Wall | "">(
    isWall(initialWindowWall) ? initialWindowWall : ""
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const sel = form.querySelector<HTMLInputElement>(
        'input[name="data.room_layout"]:checked'
      );
      if (sel && isRoomLayout(sel.value)) setLayout(sel.value);
      const island = form.querySelector<HTMLInputElement>(
        'input[name="data.has_island"]'
      );
      if (island) setHasIsland(island.checked);
      const rot = form.querySelector<HTMLInputElement>(
        'input[name="data.island_rotation"]:checked'
      );
      if (rot) setIslandRot(rot.value === "90" ? 90 : 0);
    };
    sync();
    form.addEventListener("change", sync);
    form.addEventListener("input", sync);
    return () => {
      form.removeEventListener("change", sync);
      form.removeEventListener("input", sync);
    };
  }, []);

  useEffect(() => {
    if (windowWall === "b" && layout === "lin") setWindowWall("");
    if (windowWall === "c" && layout !== "u" && layout !== "wneka" && layout !== "kwadrat" && layout !== "kwadrat_pol") setWindowWall("");
    if (windowWall === "a" && layout === "wneka") setWindowWall("");
    if (windowWall === "d" && layout !== "kwadrat" && layout !== "kwadrat_pol") setWindowWall("");
  }, [layout, windowWall]);

  const toggle = (w: Wall) => setWindowWall((c) => (c === w ? "" : w));

  const { showB, showC, showD, halfD } = wallVisibility(layout);
  const shortAC = layout === "wneka";

  const dX = halfD ? 100 : 26;
  const dW = halfD ? 74 : 148;
  const dTextX = halfD ? 137 : 100;
  const dWinX = halfD ? 117 : 80;

  const wallAH = shortAC ? 48 : 136;
  const wallCH = shortAC ? 48 : 136;

  return (
    <div ref={ref} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <input type="hidden" name="data.window_wall" value={windowWall} />
      <p className="text-[11px] text-zinc-500 mb-2 text-center">
        Kliknij ścianę, aby zaznaczyć okno
      </p>
      <svg viewBox="0 0 200 160" className="w-full max-w-[280px] mx-auto block">
        <rect x="22" y="22" width="156" height="116" fill={ROOM} stroke="#e4e4e7" />

        {/* Wall A — left */}
        <g onClick={() => !shortAC && toggle("a")} style={{ cursor: shortAC ? "default" : "pointer" }}>
          <rect
            x="12"
            y="12"
            width="14"
            height={wallAH}
            fill={windowWall === "a" ? WALL_ACTIVE : WALL}
          />
          <text x="19" y={12 + wallAH / 2 + 4} textAnchor="middle"
            fill={windowWall === "a" ? "#282624" : "#fff"}
            fontSize="10" fontWeight="700">A</text>
          {windowWall === "a" && !shortAC && (
            <rect x="12" y="62" width="14" height="36" fill={WINDOW} stroke={WINDOW_BORDER} strokeWidth="0.8" />
          )}
        </g>

        {/* Wall B — top */}
        {showB && (
          <g onClick={() => toggle("b")} style={{ cursor: "pointer" }}>
            <rect
              x="26"
              y="12"
              width={showC ? 148 : 162}
              height="14"
              fill={windowWall === "b" ? WALL_ACTIVE : WALL}
            />
            <text x={showC ? 100 : 107} y="22" textAnchor="middle"
              fill={windowWall === "b" ? "#282624" : "#fff"}
              fontSize="10" fontWeight="700">B</text>
            {windowWall === "b" && (
              <rect x={showC ? 80 : 87} y="12" width="40" height="14" fill={WINDOW} stroke={WINDOW_BORDER} strokeWidth="0.8" />
            )}
          </g>
        )}

        {/* Wall C — right */}
        {showC && (
          <g onClick={() => !shortAC && toggle("c")} style={{ cursor: shortAC ? "default" : "pointer" }}>
            <rect
              x="174"
              y="12"
              width="14"
              height={wallCH}
              fill={windowWall === "c" ? WALL_ACTIVE : WALL}
            />
            <text x="181" y={12 + wallCH / 2 + 4} textAnchor="middle"
              fill={windowWall === "c" ? "#282624" : "#fff"}
              fontSize="10" fontWeight="700">C</text>
            {windowWall === "c" && !shortAC && (
              <rect x="174" y="62" width="14" height="36" fill={WINDOW} stroke={WINDOW_BORDER} strokeWidth="0.8" />
            )}
          </g>
        )}

        {/* Wall D — bottom (kwadrat: pełna; kwadrat_pol: połowa od strony C) */}
        {showD && (
          <g onClick={() => toggle("d")} style={{ cursor: "pointer" }}>
            <rect
              x={dX}
              y="134"
              width={dW}
              height="14"
              fill={windowWall === "d" ? WALL_ACTIVE : WALL}
            />
            <text x={dTextX} y="144" textAnchor="middle"
              fill={windowWall === "d" ? "#282624" : "#fff"}
              fontSize="10" fontWeight="700">D</text>
            {windowWall === "d" && (
              <rect x={dWinX} y="134" width="40" height="14" fill={WINDOW} stroke={WINDOW_BORDER} strokeWidth="0.8" />
            )}
          </g>
        )}

        {/* Etykietka 600 mm dla wnęki */}
        {shortAC && (
          <>
            <text x="34" y="46" fill="#71717a" fontSize="6">~600</text>
            <text x="155" y="46" fill="#71717a" fontSize="6">~600</text>
          </>
        )}

        {/* Wyspa */}
        {hasIsland && (() => {
          const w = islandRot === 90 ? 32 : 60;
          const h = islandRot === 90 ? 60 : 32;
          const cx = 100;
          const cy = showD ? 94 : 106;
          return (
            <>
              <rect
                x={cx - w / 2}
                y={cy - h / 2}
                width={w}
                height={h}
                fill="#e4e4e7"
                stroke="#a1a1aa"
                strokeDasharray="3 2"
              />
              <text x={cx} y={cy + 3} textAnchor="middle" fill="#71717a" fontSize="8">wyspa</text>
            </>
          );
        })()}
      </svg>
      <p className="text-[11px] text-center text-zinc-600 mt-2">
        {windowWall ? `Okno: ściana ${windowWall.toUpperCase()}` : "Bez okna lub nie zaznaczono"}
        {hasIsland && ` • z wyspą (${islandRot}°)`}
      </p>
      {shortAC && (
        <p className="text-[11px] text-center text-zinc-500 mt-1">
          Wnęka: ścianka A i C ~600 mm — wpisz dokładne wymiary w polach Ściana A/C.
        </p>
      )}
      {showD && (
        <p className="text-[11px] text-center text-zinc-500 mt-1">
          {halfD
            ? "Kwadrat z ½ D: A lewa, B góra, C prawa, D dolna do połowy (od strony C)."
            : "Kwadrat: 4 ściany (A lewa, B góra, C prawa, D dół) — wpisz wszystkie 4 długości."}
        </p>
      )}
    </div>
  );
}
