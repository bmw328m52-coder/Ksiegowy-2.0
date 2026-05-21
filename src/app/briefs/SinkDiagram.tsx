"use client";

import { useEffect, useRef, useState } from "react";

export default function SinkDiagram() {
  const [w, setW] = useState<string>("");
  const [d, setD] = useState<string>("");
  const [h, setH] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const wEl = form.querySelector<HTMLInputElement>(
        'input[name="data.sink_width_mm"]'
      );
      const dEl = form.querySelector<HTMLInputElement>(
        'input[name="data.sink_depth_mm"]'
      );
      const hEl = form.querySelector<HTMLInputElement>(
        'input[name="data.sink_height_mm"]'
      );
      if (wEl) setW(wEl.value);
      if (dEl) setD(dEl.value);
      if (hEl) setH(hEl.value);
    };
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div ref={ref} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-[11px] text-zinc-500 mb-2 text-center">
        Schemat umywalki (W × D × H)
      </p>
      <svg viewBox="0 0 220 140" className="w-full max-w-[300px] mx-auto block">
        {/* Widok z góry: prostokąt W × D */}
        <text x="50" y="14" fontSize="7" fill="#71717a" textAnchor="middle">
          widok z góry
        </text>
        <rect
          x="15"
          y="20"
          width="80"
          height="44"
          fill="#fafaf9"
          stroke="#282624"
          strokeWidth="1.5"
          rx="3"
        />
        <ellipse cx="55" cy="42" rx="28" ry="14" fill="none" stroke="#a1a1aa" strokeWidth="1" />
        <circle cx="55" cy="42" r="2" fill="#a1a1aa" />

        {/* Wymiar W (szerokość) — pod */}
        <line x1="15" y1="72" x2="95" y2="72" stroke="#71717a" strokeWidth="0.7" />
        <line x1="15" y1="69" x2="15" y2="75" stroke="#71717a" strokeWidth="0.7" />
        <line x1="95" y1="69" x2="95" y2="75" stroke="#71717a" strokeWidth="0.7" />
        <text x="55" y="82" fontSize="7" fill="#52525b" textAnchor="middle">
          W = {w || "?"} mm
        </text>

        {/* Wymiar D (głębokość) — z prawej */}
        <line x1="102" y1="20" x2="102" y2="64" stroke="#71717a" strokeWidth="0.7" />
        <line x1="99" y1="20" x2="105" y2="20" stroke="#71717a" strokeWidth="0.7" />
        <line x1="99" y1="64" x2="105" y2="64" stroke="#71717a" strokeWidth="0.7" />
        <text x="108" y="45" fontSize="7" fill="#52525b">
          D = {d || "?"} mm
        </text>

        {/* Widok z boku: prostokąt z H */}
        <text x="175" y="14" fontSize="7" fill="#71717a" textAnchor="middle">
          widok z boku
        </text>
        <rect
          x="145"
          y="40"
          width="60"
          height="22"
          fill="#fafaf9"
          stroke="#282624"
          strokeWidth="1.5"
          rx="2"
        />
        <path
          d="M 155 42 Q 175 58 195 42"
          fill="none"
          stroke="#a1a1aa"
          strokeWidth="1"
        />

        {/* Wymiar H — z prawej widoku z boku */}
        <line x1="212" y1="40" x2="212" y2="62" stroke="#71717a" strokeWidth="0.7" />
        <line x1="209" y1="40" x2="215" y2="40" stroke="#71717a" strokeWidth="0.7" />
        <line x1="209" y1="62" x2="215" y2="62" stroke="#71717a" strokeWidth="0.7" />
        <text x="175" y="78" fontSize="7" fill="#52525b" textAnchor="middle">
          H = {h || "?"} mm
        </text>

        {/* Schemat szafki pod umywalkę */}
        <text x="110" y="105" fontSize="7" fill="#71717a" textAnchor="middle">
          szafka pod umywalkę (opcjonalna)
        </text>
        <rect
          x="50"
          y="110"
          width="120"
          height="22"
          fill="none"
          stroke="#a1a1aa"
          strokeDasharray="3 2"
          strokeWidth="1"
        />
        <line x1="105" y1="110" x2="105" y2="132" stroke="#a1a1aa" strokeDasharray="2 2" />
        <line x1="115" y1="110" x2="115" y2="132" stroke="#a1a1aa" strokeDasharray="2 2" />
      </svg>
      <p className="text-[11px] text-center text-zinc-500 mt-1">
        Wpisz wymiary umywalki — schemat aktualizuje się na bieżąco.
      </p>
    </div>
  );
}
