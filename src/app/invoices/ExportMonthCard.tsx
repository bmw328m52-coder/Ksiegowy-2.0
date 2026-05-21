"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

const MONTHS_PL = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

function defaultPrevMonth(now: Date = new Date()): { year: number; month: number } {
  const y = now.getFullYear();
  const m = now.getMonth();
  return m === 0 ? { year: y - 1, month: 12 } : { year: y, month: m };
}

export default function ExportMonthCard() {
  const init = defaultPrevMonth();
  const [year, setYear] = useState<number>(init.year);
  const [month, setMonth] = useState<number>(init.month);
  const [busy, setBusy] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/export-month?year=${year}&month=${month}`);
      if (!res.ok) {
        const text = await res.text();
        toast.error(`Błąd eksportu: ${text || res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `faktury_${year}_${String(month).padStart(2, "0")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Pobrano ZIP za ${String(month).padStart(2, "0")}/${year}`);
    } catch (e) {
      toast.error(`Błąd: ${e instanceof Error ? e.message : "nieznany"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3 mb-3 space-y-2">
      <p className="text-xs font-medium text-zinc-700">Eksport dla księgowej</p>
      <div className="flex gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="flex-1 rounded-md border border-zinc-300 bg-white text-sm px-2 py-2"
          aria-label="Miesiąc"
        >
          {MONTHS_PL.map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border border-zinc-300 bg-white text-sm px-2 py-2"
          aria-label="Rok"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="w-full rounded-md bg-accent text-white text-sm py-2 font-medium active:opacity-80 disabled:opacity-50"
      >
        {busy ? "Generuję ZIP..." : "Pobierz ZIP (CSV + zdjęcia)"}
      </button>
      <p className="text-[11px] text-zinc-500">
        ZIP zawiera CSV z fakturami + folder ze zdjęciami/PDF-ami z wybranego miesiąca.
      </p>
    </section>
  );
}
