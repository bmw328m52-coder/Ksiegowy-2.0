"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { fmtPLN } from "@/lib/format";
import {
  CAB_KIND_LABELS,
  bomOf,
  costOfBom,
  priceOf,
  sumParts,
  type Cab,
  type Extra,
  type Rates,
} from "@/lib/cabinetPricing";
import { resetCabinetRatesAction, saveCabinetRatesAction } from "./actions";

type NumKey = Exclude<keyof Rates, "extras">;

const GROUPS: { title: string; hint?: string; fields: { key: NumKey; label: string; unit: string; hint?: string }[] }[] = [
  {
    title: "Korpus",
    hint: "Płyta, cięcie i oklejanie w hurtowni.",
    fields: [
      { key: "board_m2", label: "Płyta korpusu", unit: "zł/m²", hint: "z faktur: biel 45,9 · dąb artisan 36,9 · kaszmir 35,6 · halifax 96,5" },
      { key: "board_extra_pct", label: "Odpad i elementy poza szafkami", unit: "%", hint: "rozkrój, blendy, cokoły, panele boczne" },
      { key: "cut_mb", label: "Cięcie", unit: "zł/mb" },
      { key: "cut_mb_per_m2", label: "Cięcia na 1 m² płyty", unit: "mb" },
      { key: "edge_mb", label: "Oklejanie (obrzeże + usługa)", unit: "zł/mb" },
      { key: "edge_extra_pct", label: "Oklejanie ponad sam korpus", unit: "%", hint: "półki z 4 stron, blendy, cokoły" },
      { key: "hdf_m2", label: "Plecy HDF", unit: "zł/m²" },
    ],
  },
  {
    title: "Fronty i blat",
    fields: [
      { key: "front_m2", label: "Fronty zamawiane", unit: "zł/m²", hint: "lakier / akryl — Denis 358" },
      { key: "front_laminate_m2", label: "Fronty z płyty laminowanej", unit: "zł/m²", hint: "płyta + cięcie + oklejanie + frez — Turek ok. 115" },
      { key: "front_extra_pct", label: "Blendy i panele frontowe", unit: "%" },
      { key: "worktop_mb", label: "Blat", unit: "zł/mb", hint: "za metr szafek dolnych — Turek 218, Denis 400" },
    ],
  },
  {
    title: "Okucia",
    fields: [
      { key: "hinge", label: "Zawias z prowadnikiem", unit: "zł/szt" },
      { key: "drawer_set", label: "Szuflada (komplet)", unit: "zł/szt" },
      { key: "flap_set", label: "Podnośnik klapy (Aventos)", unit: "zł/front" },
      { key: "leg", label: "Nóżka", unit: "zł/szt" },
      { key: "hang_set", label: "Zawieszki + szyna", unit: "zł/szafkę" },
      { key: "handle", label: "Uchwyt", unit: "zł/front" },
    ],
  },
  {
    title: "Pozostałe",
    fields: [{ key: "overhead_pct", label: "Drobne, transport, paliwo", unit: "%", hint: "od kosztu szafek" }],
  },
];

const EXAMPLES: { name: string; cab: Cab }[] = [
  { name: "Dolna 600 — drzwi", cab: { kind: "lower_doors", w: 600, h: 720, d: 560 } },
  { name: "Dolna 600 — 3 szuflady", cab: { kind: "lower_drawers", w: 600, h: 720, d: 560 } },
  { name: "Dolna 900 — 3 szuflady", cab: { kind: "lower_drawers", w: 900, h: 720, d: 560 } },
  { name: "Zlewowa 800", cab: { kind: "sink", w: 800, h: 720, d: 560 } },
  { name: "Górna 600 × 720 — drzwi", cab: { kind: "upper_doors", w: 600, h: 720, d: 350 } },
  { name: "Górna 600 × 360 — klapa", cab: { kind: "upper_flap", w: 600, h: 360, d: 350 } },
  { name: "Słupek 600 × 2100", cab: { kind: "tall", w: 600, h: 2100, d: 560 } },
  { name: "Front zmywarki 600", cab: { kind: "appliance_front", w: 600, h: 720, d: 0 } },
];

const num = (s: string) => {
  const v = Number(String(s).replace(",", ".").trim());
  return Number.isFinite(v) && v >= 0 ? v : 0;
};
const str = (v: number) => String(v).replace(".", ",");

const INPUT =
  "w-full rounded-lg border border-[#e3e2de] bg-white px-2.5 py-2 text-right text-[15px] tabular-nums text-[#1f1d1b] focus:border-[#a06f3f] focus:outline-none";

export default function CabinetRatesForm({ initial, defaults, saved }: { initial: Rates; defaults: Rates; saved: boolean }) {
  const toFields = (r: Rates) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => k !== "extras").map(([k, v]) => [k, str(v as number)])) as Record<NumKey, string>;
  const toExtras = (r: Rates) => r.extras.map((e) => ({ ...e, price: str(e.price) }));

  const [fields, setFields] = useState(() => toFields(initial));
  const [extras, setExtras] = useState(() => toExtras(initial));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  const [dirty, setDirty] = useState(false);

  const rates: Rates = useMemo(() => {
    const out = { ...defaults } as Rates;
    for (const k of Object.keys(fields) as NumKey[]) out[k] = num(fields[k]);
    out.extras = extras
      .filter((e) => e.name.trim())
      .map<Extra>((e) => ({ key: e.key, name: e.name.trim(), unit: e.unit.trim() || "szt", price: num(e.price) }));
    return out;
  }, [fields, extras, defaults]);

  const touch = () => {
    setDirty(true);
    setStatus({});
  };
  const set = (k: NumKey, v: string) => {
    setFields((f) => ({ ...f, [k]: v }));
    touch();
  };
  const setExtra = (i: number, patch: Partial<(typeof extras)[number]>) => {
    setExtras((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    touch();
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveCabinetRatesAction(rates);
      if (res.error) setStatus({ error: res.error });
      else {
        setStatus({ ok: "Zapisano" });
        setDirty(false);
      }
    });

  const reset = () => {
    if (!window.confirm("Przywrócić stawki skalibrowane na fakturach? Twoje zmiany przepadną.")) return;
    startTransition(async () => {
      const res = await resetCabinetRatesAction();
      if (res.error) return setStatus({ error: res.error });
      setFields(toFields(defaults));
      setExtras(toExtras(defaults));
      setDirty(false);
      setStatus({ ok: "Przywrócono stawki domyślne" });
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card tone="accent" className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-tight text-[#1f1d1b]">Marża</div>
          <div className="text-[12px] text-[#6f6c66]">
            Narzut na koszt materiału — Twoja robocizna i zysk. Cena = koszt × (1 + marża). Kuchnia Denis wyszła na 62%, Ani Turek na 106% — domyślnie środek.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={fields.margin_pct}
            onChange={(e) => set("margin_pct", e.target.value)}
            className={`${INPUT} w-24 text-[20px] font-semibold`}
            aria-label="Marża w procentach"
          />
          <span className="text-[15px] font-semibold text-[#6f6c66]">%</span>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          {GROUPS.map((g) => (
            <Card key={g.title}>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#a06f3f]">{g.title}</h2>
              {g.hint && <p className="text-[12px] text-[#6f6c66]">{g.hint}</p>}
              <ul className="mt-2 divide-y divide-[#f0efec]">
                {g.fields.map((f) => (
                  <li key={f.key} className="flex items-center gap-3 py-2">
                    <label htmlFor={`r-${f.key}`} className="min-w-0 flex-1">
                      <span className="block text-[14px] text-[#1f1d1b]">{f.label}</span>
                      {f.hint && <span className="block text-[11px] text-[#8b8882]">{f.hint}</span>}
                    </label>
                    <input
                      id={`r-${f.key}`}
                      inputMode="decimal"
                      value={fields[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      className={`${INPUT} w-24`}
                    />
                    <span className="w-16 text-[12px] text-[#6f6c66]">{f.unit}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#a06f3f]">Przykładowe szafki</h2>
            <p className="text-[12px] text-[#6f6c66]">Przeliczają się na żywo, gdy zmieniasz stawki.</p>
            <table className="mt-2 w-full text-[13px]">
              <thead className="text-left text-[11px] text-[#8b8882]">
                <tr>
                  <th className="py-1 font-medium">Szafka</th>
                  <th className="py-1 text-right font-medium">Koszt</th>
                  <th className="py-1 text-right font-medium">Cena</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLES.map((ex) => {
                  const cost = sumParts(costOfBom(bomOf(ex.cab), rates));
                  return (
                    <tr key={ex.name} className="border-t border-[#f0efec]">
                      <td className="py-1.5 pr-2">
                        {ex.name}
                        <span className="block text-[11px] text-[#8b8882]">{CAB_KIND_LABELS[ex.cab.kind]}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-[#6f6c66]">{fmtPLN(cost)}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{fmtPLN(priceOf(cost, rates))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-[#8b8882]">
              W cenie szafki: korpus, plecy, front, okucia, uchwyt, a przy dolnych także blat nad szafką.
            </p>
          </Card>

          <Card>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#a06f3f]">Dodatki</h2>
            <p className="text-[12px] text-[#6f6c66]">Koszt zakupu — marża dolicza się tak samo jak do szafek.</p>
            <ul className="mt-2 flex flex-col gap-2">
              {extras.map((e, i) => (
                <li key={e.key} className="flex items-center gap-2">
                  <input
                    value={e.name}
                    onChange={(ev) => setExtra(i, { name: ev.target.value })}
                    placeholder="Nazwa"
                    className={`${INPUT} min-w-0 flex-1 text-left`}
                    aria-label="Nazwa dodatku"
                  />
                  <input
                    value={e.unit}
                    onChange={(ev) => setExtra(i, { unit: ev.target.value })}
                    className={`${INPUT} w-14 text-center`}
                    aria-label="Jednostka"
                  />
                  <input
                    inputMode="decimal"
                    value={e.price}
                    onChange={(ev) => setExtra(i, { price: ev.target.value })}
                    className={`${INPUT} w-24`}
                    aria-label="Koszt"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setExtras((xs) => xs.filter((_, j) => j !== i));
                      touch();
                    }}
                    className="px-1.5 text-[18px] leading-none text-[#b3b0a9] hover:text-[#b8523a]"
                    aria-label={`Usuń ${e.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              type="button"
              onClick={() => {
                setExtras((xs) => [...xs, { key: `extra_${Date.now().toString(36)}`, name: "", unit: "szt", price: "0" }]);
                touch();
              }}
            >
              + Dodatek
            </Button>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+72px)] z-20 md:bottom-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[#ededea] bg-white/95 p-3 shadow-[0_8px_24px_rgba(40,38,36,0.12)] backdrop-blur">
          <span className={`min-w-0 flex-1 text-[13px] ${status.error ? "text-[#b8523a]" : "text-[#6f6c66]"}`}>
            {status.error ?? status.ok ?? (dirty ? "Niezapisane zmiany" : saved ? "Twoje stawki" : "Stawki z faktur (domyślne)")}
          </span>
          <Button variant="ghost" size="sm" type="button" onClick={reset} disabled={pending}>
            Przywróć domyślne
          </Button>
          <Button type="button" onClick={save} disabled={pending || !dirty}>
            {pending ? "Zapisuję…" : "Zapisz"}
          </Button>
        </div>
      </div>
    </div>
  );
}
