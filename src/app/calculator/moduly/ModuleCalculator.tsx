"use client";

import { useMemo, useState } from "react";
import { fmtPLN, parseAmount } from "@/lib/format";
import {
  MODULES,
  type BlatOption,
  type BoardOption,
  type FrontOption,
  type HandleOption,
  type ModuleCategory,
  type ModuleDef,
} from "./catalog";
import { calcKitchen, costOfModule, type Prices, type Selection } from "./pricing";

const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  dolne: "Dolne",
  gorne: "Górne",
  slupki: "Słupki",
  narozniki: "Narożne",
};

const CATEGORIES: ModuleCategory[] = ["dolne", "gorne", "slupki", "narozniki"];

type Props = {
  boards: BoardOption[];
  fronts: FrontOption[];
  blaty: BlatOption[];
  uchwyty: HandleOption[];
  prices: Prices;
};

export default function ModuleCalculator({ boards, fronts, blaty, uchwyty, prices }: Props) {
  const [boardId, setBoardId] = useState(boards[1]?.id ?? boards[0]?.id ?? "");
  const [frontId, setFrontId] = useState(fronts[2]?.id ?? fronts[0]?.id ?? "");
  const [blatId, setBlatId] = useState<string>(blaty[2]?.id ?? blaty[0]?.id ?? "");
  const [uchwytId, setUchwytId] = useState(uchwyty[1]?.id ?? uchwyty[0]?.id ?? "");
  const [selections, setSelections] = useState<Selection[]>([
    { code: "D60", qty: 2 },
    { code: "D60-S3", qty: 1 },
    { code: "D80-Z", qty: 1 },
    { code: "G60", qty: 3 },
    { code: "S60-P", qty: 1 },
  ]);
  const [blatMbStr, setBlatMbStr] = useState("3.6");
  const [laborRateStr, setLaborRateStr] = useState("80");
  const [marginStr, setMarginStr] = useState("35");
  const [vatStr, setVatStr] = useState("23");

  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  const front = fronts.find((f) => f.id === frontId) ?? fronts[0];
  const blat = blaty.find((b) => b.id === blatId) ?? null;
  const handle = uchwyty.find((h) => h.id === uchwytId) ?? uchwyty[0];

  const blat_mb = Math.max(0, parseAmount(blatMbStr) ?? 0);
  const laborRatePerHour = Math.max(0, parseAmount(laborRateStr) ?? 0);
  const marginPct = Math.max(0, (parseAmount(marginStr) ?? 0) / 100);
  const vatRate = Math.max(0, (parseAmount(vatStr) ?? 0) / 100);

  const breakdown = useMemo(
    () =>
      calcKitchen({
        selections,
        modules: MODULES,
        board,
        front,
        handle,
        blat,
        blat_mb,
        laborRatePerHour,
        marginPct,
        vatRate,
        prices,
      }),
    [selections, board, front, handle, blat, blat_mb, laborRatePerHour, marginPct, vatRate, prices],
  );

  function addModule(code: string) {
    setSelections((prev) => {
      const ex = prev.find((s) => s.code === code);
      if (ex) return prev.map((s) => (s.code === code ? { ...s, qty: s.qty + 1 } : s));
      return [...prev, { code, qty: 1 }];
    });
  }

  function setQty(code: string, qty: number) {
    setSelections((prev) =>
      qty <= 0
        ? prev.filter((s) => s.code !== code)
        : prev.map((s) => (s.code === code ? { ...s, qty } : s)),
    );
  }

  const selectedModules = selections
    .map((s) => {
      const m = MODULES.find((x) => x.code === s.code);
      if (!m) return null;
      const c = costOfModule(m, board, front, handle, prices);
      return { sel: s, mod: m, cost: c };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="flex flex-col gap-5">
      <Section title="Materiały">
        <div className="grid grid-cols-1 gap-3">
          <Field label="Korpus (płyta 18mm)">
            <select value={boardId} onChange={(e) => setBoardId(e.target.value)} className="input">
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {fmtPLN(b.price_m2)}/m²
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fronty">
            <select value={frontId} onChange={(e) => setFrontId(e.target.value)} className="input">
              {fronts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {fmtPLN(f.price_m2)}/m²
                </option>
              ))}
            </select>
          </Field>
          <Field label="Uchwyty">
            <select
              value={uchwytId}
              onChange={(e) => setUchwytId(e.target.value)}
              className="input"
            >
              {uchwyty.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.price_szt > 0 ? ` — ${fmtPLN(u.price_szt)}/szt` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Moduły">
        <p className="text-[11px] text-[#6b6661] -mt-1">
          Kliknij moduł, by dodać do wyceny. Edytuj ilość niżej.
        </p>
        <div className="flex flex-col gap-3">
          {CATEGORIES.map((cat) => {
            const items = MODULES.filter((m) => m.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-[10px] uppercase tracking-wide font-semibold text-[#9ea29c] mb-1.5">
                  {CATEGORY_LABEL[cat]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => addModule(m.code)}
                      className="rounded-lg border border-[#e6dcc7] bg-white px-2.5 py-1.5 text-[12px] text-[#282624] hover:border-[#a06f3f] hover:bg-[#faf7f2] active:bg-[#f1e5d2] transition-colors"
                    >
                      <span className="font-semibold">{m.code}</span>
                      <span className="text-[#6b6661] ml-1">· {m.width_mm}mm</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {selectedModules.length > 0 ? (
          <div className="mt-2 rounded-2xl border border-[#e8e4dd] bg-white divide-y divide-[#f0ece5] overflow-hidden">
            {selectedModules.map(({ sel, mod, cost }) => (
              <ModuleRow
                key={sel.code}
                module={mod}
                qty={sel.qty}
                unitCost={cost.total}
                onChangeQty={(q) => setQty(sel.code, q)}
              />
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[#9c9081] italic">
            Brak modułów. Kliknij coś z listy wyżej.
          </p>
        )}
      </Section>

      <Section title="Blat">
        <div className="grid grid-cols-1 gap-3">
          <Field label="Rodzaj blatu">
            <select
              value={blatId}
              onChange={(e) => setBlatId(e.target.value)}
              className="input"
            >
              <option value="">— bez blatu —</option>
              {blaty.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {fmtPLN(b.price_mb)}/mb
                </option>
              ))}
            </select>
          </Field>
          {blat && (
            <Field label="Długość blatu (mb)">
              <input
                inputMode="decimal"
                value={blatMbStr}
                onChange={(e) => setBlatMbStr(e.target.value)}
                placeholder="np. 3.6"
                className="input"
              />
            </Field>
          )}
        </div>
      </Section>

      <Section title="Robocizna i marża">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stawka robocizny (PLN/h)">
            <input
              inputMode="decimal"
              value={laborRateStr}
              onChange={(e) => setLaborRateStr(e.target.value)}
              placeholder="80"
              className="input"
            />
          </Field>
          <Field label="Szacowane godziny">
            <input
              value={breakdown.laborHours.toFixed(1)}
              disabled
              className="input"
              aria-label="Suma godzin z modułów"
            />
          </Field>
        </div>
        <p className="text-[11px] text-[#9c9081] -mt-1">
          Godziny liczone z czasu modułowego (suma BOM × labor_min).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marża (%)">
            <input
              inputMode="decimal"
              value={marginStr}
              onChange={(e) => setMarginStr(e.target.value)}
              placeholder="35"
              className="input"
            />
          </Field>
          <Field label="VAT (%)">
            <select
              value={vatStr}
              onChange={(e) => setVatStr(e.target.value)}
              className="input"
            >
              <option value="23">23%</option>
              <option value="8">8%</option>
              <option value="0">0%</option>
            </select>
          </Field>
        </div>
      </Section>

      <ResultPanel breakdown={breakdown} />

      <style jsx>{`
        .input {
          width: 100%;
          height: 42px;
          padding: 0 12px;
          border-radius: 0.5rem;
          border: 1px solid #e4e4e7;
          background: white;
          font-size: 16px;
          color: #282624;
        }
        .input:focus {
          outline: 2px solid #a06f3f;
          outline-offset: 1px;
        }
        .input:disabled {
          background: #f5f1ea;
          color: #6b6661;
        }
      `}</style>
    </div>
  );
}

function ModuleRow({
  module: mod,
  qty,
  unitCost,
  onChangeQty,
}: {
  module: ModuleDef;
  qty: number;
  unitCost: number;
  onChangeQty: (q: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#282624] truncate leading-tight">
          <span className="text-[#a06f3f]">{mod.code}</span> · {mod.name}
        </p>
        <p className="text-[10.5px] text-[#9c9081] truncate mt-0.5">
          {mod.width_mm}×{mod.height_mm}×{mod.depth_mm}mm · koszt {fmtPLN(unitCost)}/szt
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onChangeQty(qty - 1)}
          className="w-8 h-8 rounded-md border border-[#e6dcc7] text-[#6b6661] hover:border-[#a06f3f] hover:text-[#a06f3f] active:bg-[#f1e5d2]"
          aria-label="Zmniejsz"
        >
          −
        </button>
        <span className="w-7 text-center text-sm font-semibold tabular-nums">{qty}</span>
        <button
          type="button"
          onClick={() => onChangeQty(qty + 1)}
          className="w-8 h-8 rounded-md border border-[#e6dcc7] text-[#6b6661] hover:border-[#a06f3f] hover:text-[#a06f3f] active:bg-[#f1e5d2]"
          aria-label="Zwiększ"
        >
          +
        </button>
      </div>
      <p className="w-24 text-right tabular-nums text-sm font-semibold text-[#282624] shrink-0">
        {fmtPLN(unitCost * qty)}
      </p>
    </div>
  );
}

function ResultPanel({
  breakdown,
}: {
  breakdown: ReturnType<typeof calcKitchen>;
}) {
  const positive = breakdown.profit >= 0;
  return (
    <section className="flex flex-col gap-3">
      <div
        className="rounded-2xl border border-[#e2c79c] p-4 shadow-[0_2px_8px_rgba(160,111,63,0.10)]"
        style={{ background: "linear-gradient(160deg, #fbf1dd 0%, #fff8e9 100%)" }}
      >
        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#a18653]">
          Cena dla klienta · brutto
        </p>
        <p className="text-[34px] leading-none font-bold tabular-nums text-[#7d5530] mt-1.5">
          {fmtPLN(breakdown.priceGross)}
        </p>
        <p className="text-[11px] text-[#a18653] mt-1.5">
          netto {fmtPLN(breakdown.priceNet)} · VAT {fmtPLN(breakdown.vatAmount)}
        </p>
      </div>

      <div className="rounded-2xl border border-[#e8e4dd] bg-white overflow-hidden">
        <GroupHeader>Koszt własny</GroupHeader>
        <Row label="Moduły (materiał + okucia)" value={fmtPLN(breakdown.modulesNet)} />
        <Row label="Blat" value={fmtPLN(breakdown.blatNet)} />
        <Row
          label={`Robocizna (${breakdown.laborHours.toFixed(1)} h)`}
          value={fmtPLN(breakdown.laborNet)}
        />
        <Row label="Razem koszt netto" value={fmtPLN(breakdown.costNet)} bold />

        <GroupHeader>Marża i podatek</GroupHeader>
        <Row label="+ Marża" value={`+ ${fmtPLN(breakdown.marginAmount)}`} sub />
        <Row label="= Cena netto" value={fmtPLN(breakdown.priceNet)} bold />
        <Row label="+ VAT" value={`+ ${fmtPLN(breakdown.vatAmount)}`} sub />
        <Row label="= Cena brutto" value={fmtPLN(breakdown.priceGross)} highlight />
      </div>

      <div
        className={`rounded-xl border p-3.5 ${
          positive ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
        }`}
      >
        <p
          className={`text-[11px] uppercase tracking-wide font-semibold ${
            positive ? "text-emerald-700" : "text-red-700"
          }`}
        >
          Zysk z wyceny (cena netto − koszt)
        </p>
        <p
          className={`text-2xl font-bold tabular-nums mt-1 ${
            positive ? "text-emerald-900" : "text-red-900"
          }`}
        >
          {fmtPLN(breakdown.profit)}
        </p>
        <p
          className={`text-[11px] mt-1 ${
            positive ? "text-emerald-700/80" : "text-red-700/80"
          }`}
        >
          przed PIT i ZUS (te policzy /calculator)
        </p>
      </div>

      <p className="text-[11px] text-[#9c9081] text-center">
        MVP — dane modułów i materiałów to wartości startowe. W kolejnym kroku podstawimy twoje ceny z faktur.
      </p>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-[#524d48]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-[#6b6661]">{label}</span>
      {children}
    </label>
  );
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9c9081] bg-[#faf7f2] border-b border-[#f0ece5]">
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  sub = false,
  highlight = false,
  bold = false,
}: {
  label: string;
  value: string;
  sub?: boolean;
  highlight?: boolean;
  bold?: boolean;
}) {
  const bg = highlight ? "bg-[#faf5e9]" : bold ? "bg-[#faf7f2]" : "";
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b last:border-b-0 border-[#f0ece5] ${bg}`}
    >
      <span className={`text-sm ${sub ? "text-[#9c9081]" : "text-[#524d48]"}`}>{label}</span>
      <span
        className={`tabular-nums ${
          highlight
            ? "text-[#7d5530] text-lg font-bold"
            : bold
              ? "text-[#282624] text-base font-semibold"
              : "text-[#282624] font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
