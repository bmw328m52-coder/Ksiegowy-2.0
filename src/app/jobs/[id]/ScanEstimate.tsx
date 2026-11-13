"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { fmtPLN } from "@/lib/format";
import {
  CAB_KIND_LABELS,
  COST_PART_LABELS,
  FRONT_TYPE_LABELS,
  SLIDE_SYSTEM_LABELS,
  cabsFromScan,
  estimate,
  manualCab,
  roundPrice,
  type Cab,
  type CabKind,
  type CostParts,
  type FrontType,
  type Rates,
  type ScanEstimateChoice,
  type SlideSystem,
} from "@/lib/cabinetPricing";
import type { ScanObject, ScanWardrobe } from "@/lib/dao/room_scans.types";
import { SCAN_OBJECT_LABELS } from "@/lib/dao/room_scans.types";
import { saveScanEstimateAction } from "./scanActions";

const KINDS = Object.keys(CAB_KIND_LABELS) as CabKind[];
const MANUAL_KINDS = KINDS.filter((k) => k !== "skip");

const SELECT =
  "rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-[13px] text-[#1f1d1b] focus:border-[var(--accent)] focus:outline-none";
const NUM = `${SELECT} w-20 text-right tabular-nums`;

const num = (s: string) => {
  const v = Number(s.replace(",", ".").trim());
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** Przybliżona cena dla klienta: szafki ze skanu (rozstawione w Skanerze) + dopisane ręcznie, wg cennika szafek. */
export default function ScanEstimate({
  scanId,
  jobId,
  objects,
  rates,
  initial,
  wardrobes,
}: {
  scanId: string;
  jobId: string;
  objects: ScanObject[];
  rates: Rates;
  initial: ScanEstimateChoice;
  wardrobes: ScanWardrobe[];
}) {
  const [choice, setChoice] = useState(initial);
  const [extraText, setExtraText] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial.extras).map(([k, v]) => [k, String(v).replace(".", ",")]))
  );
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});

  const scanCabs = useMemo(() => cabsFromScan(objects, choice.kinds), [objects, choice.kinds]);
  const est = useMemo(() => {
    const cabs: Cab[] = [...scanCabs.map((c) => c.cab), ...choice.manual.map(manualCab)];
    return estimate(cabs, choice.extras, rates, {
      fronts: choice.fronts,
      wardrobes,
      slide: choice.slide,
      margin_pct: choice.margin_pct,
    });
  }, [scanCabs, choice, rates, wardrobes]);
  const count = est.items.length;
  const hasAnything = count > 0 || est.wardrobes.length > 0 || est.extrasCost > 0;
  const hasSliding = wardrobes.some((w) => w.doors === "sliding");
  const setMargin = (v: number) => update({ margin_pct: Math.min(Math.max(Math.round(v), 0), 300) });

  const update = (patch: Partial<ScanEstimateChoice>) => {
    setChoice((c) => ({ ...c, ...patch }));
    setDirty(true);
    setStatus({});
  };

  const save = () =>
    startTransition(async () => {
      const res = await saveScanEstimateAction(scanId, jobId, choice);
      if (res.error) setStatus({ error: res.error });
      else {
        setStatus({ ok: "Zapisano" });
        setDirty(false);
      }
    });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#a06f3f]">Przybliżona cena</div>
          {hasAnything ? (
            <>
              <div className="text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-[#1f1d1b]">
                ok. {fmtPLN(roundPrice(est.price))}
              </div>
              <div className="text-[11px] text-[#6f6c66]">
                brutto · {count} {count === 1 ? "szafka" : count < 5 && count > 1 ? "szafki" : "szafek"}
                {est.wardrobes.length > 0 ? ` + ${est.wardrobes.length} ${est.wardrobes.length === 1 ? "szafa" : "szafy"}` : ""} · materiał{" "}
                {fmtPLN(est.cost)} · marża {est.margin_pct}%
              </div>
            </>
          ) : (
            <div className="text-[13px] text-[#6f6c66]">
              Rozstaw szafki w Skanerze („Auto”) albo dopisz je tutaj, żeby zobaczyć cenę.
            </div>
          )}
        </div>
        <span className="text-[12px] font-semibold text-[#a06f3f]">{open ? "Zwiń" : "Szczegóły"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-[#ecdcbd] pt-3">
          {scanCabs.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold text-[#6f6c66]">Szafki ze skanu</div>
              <ul className="flex flex-col gap-1.5">
                {scanCabs.map((c) => {
                  const item = c.kind === "skip" ? null : est.items.find((it) => it.cab === c.cab);
                  return (
                    <li key={c.id} className="flex items-center gap-2 text-[13px]">
                      <span className={`min-w-0 flex-1 ${c.kind === "skip" ? "text-[var(--muted)]" : "text-[#1f1d1b]"}`}>
                        {SCAN_OBJECT_LABELS[c.category] ?? c.category}{" "}
                        <span className="tabular-nums text-[#6f6c66]">
                          {Math.round(c.cab.w)} × {Math.round(c.cab.h)}
                        </span>
                        {!c.planned && <span className="ml-1 text-[10px] text-[var(--muted)]">wykryte w pomieszczeniu</span>}
                      </span>
                      <select
                        value={c.kind}
                        onChange={(e) => update({ kinds: { ...choice.kinds, [c.id]: e.target.value as CabKind } })}
                        className={SELECT}
                        aria-label="Rodzaj szafki"
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {CAB_KIND_LABELS[k]}
                          </option>
                        ))}
                      </select>
                      <span className="w-20 text-right font-medium tabular-nums">{item ? fmtPLN(item.price) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {wardrobes.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold text-[#6f6c66]">Szafy ze skanu</div>
              <ul className="flex flex-col gap-1.5">
                {wardrobes.map((wd) => {
                  const item = est.wardrobes.find((x) => x.id === wd.id);
                  return (
                    <li key={wd.id} className="flex items-center gap-2 text-[13px]">
                      <span className="min-w-0 flex-1 text-[#1f1d1b]">
                        Szafa{" "}
                        <span className="tabular-nums text-[#6f6c66]">
                          {Math.round(wd.width_mm)} × {Math.round(wd.height_mm)}
                        </span>{" "}
                        <span className="text-[11px] text-[var(--muted)]">
                          {wd.doors === "sliding"
                            ? `drzwi przesuwne ×${wd.door_count} — okucia ${fmtPLN(item?.slide ?? 0)}`
                            : wd.doors === "hinged"
                              ? `drzwi uchylne ×${wd.door_count}`
                              : "bez drzwi"}
                        </span>
                      </span>
                      <span className="w-20 text-right font-medium tabular-nums">{item ? fmtPLN(item.price) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
              {hasSliding && (
                <label className="mt-2 flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 text-[11px] text-[#6f6c66]">
                    Drzwi przesuwne — para drzwi na 3 m: Laguna {fmtPLN(2 * rates.slide_laguna_door + 3 * rates.slide_laguna_mb)}, GTV{" "}
                    {fmtPLN(2 * rates.slide_gtv_door + 3 * rates.slide_gtv_mb)} (same okucia)
                  </span>
                  <select value={choice.slide} onChange={(e) => update({ slide: e.target.value as SlideSystem })} className={SELECT}>
                    {(Object.keys(SLIDE_SYSTEM_LABELS) as SlideSystem[]).map((k) => (
                      <option key={k} value={k}>
                        {SLIDE_SYSTEM_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          <div>
            <div className="mb-1 text-[11px] font-semibold text-[#6f6c66]">Dopisane ręcznie</div>
            <ul className="flex flex-col gap-1.5">
              {choice.manual.map((m, i) => {
                const item = est.items[scanCabs.filter((c) => c.kind !== "skip").length + i];
                const set = (patch: Partial<typeof m>) =>
                  update({ manual: choice.manual.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <li key={i} className="flex items-center gap-2 text-[13px]">
                    <select value={m.kind} onChange={(e) => set({ kind: e.target.value as CabKind })} className={`${SELECT} min-w-0 flex-1`}>
                      {MANUAL_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {CAB_KIND_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    <select value={m.w} onChange={(e) => set({ w: Number(e.target.value) })} className={SELECT} aria-label="Szerokość">
                      {[150, 200, 300, 400, 450, 500, 600, 800, 900, 1000, 1200].map((w) => (
                        <option key={w} value={w}>
                          {w} mm
                        </option>
                      ))}
                    </select>
                    <span className="w-20 text-right font-medium tabular-nums">{item ? fmtPLN(item.price) : "—"}</span>
                    <button
                      type="button"
                      onClick={() => update({ manual: choice.manual.filter((_, j) => j !== i) })}
                      className="px-1 text-[18px] leading-none text-[var(--muted)] hover:text-[#b8523a]"
                      aria-label="Usuń szafkę"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              type="button"
              onClick={() => update({ manual: [...choice.manual, { kind: "lower_drawers", w: 600 }] })}
            >
              + Szafka
            </Button>
          </div>

          <label className="flex items-center gap-2 text-[13px]">
            <span className="min-w-0 flex-1 text-[11px] font-semibold text-[#6f6c66]">Fronty</span>
            <select value={choice.fronts} onChange={(e) => update({ fronts: e.target.value as FrontType })} className={SELECT}>
              {(Object.keys(FRONT_TYPE_LABELS) as FrontType[]).map((k) => (
                <option key={k} value={k}>
                  {FRONT_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="min-w-0 flex-1 text-[11px] font-semibold text-[#6f6c66]">
              Marża dla tej wyceny
              {choice.margin_pct != null && choice.margin_pct !== rates.margin_pct && (
                <button
                  type="button"
                  onClick={() => {
                    const { margin_pct: _drop, ...rest } = choice;
                    void _drop;
                    setChoice(rest);
                    setDirty(true);
                    setStatus({});
                  }}
                  className="ml-2 font-normal text-[#a06f3f] underline-offset-2 hover:underline"
                >
                  wróć do {rates.margin_pct}%
                </button>
              )}
            </span>
            {[60, 80, 100, 120].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMargin(p)}
                className={`rounded-lg border px-2 py-1.5 text-[12px] tabular-nums ${
                  est.margin_pct === p ? "border-[#a06f3f] bg-[#a06f3f] text-white" : "border-[var(--border)] bg-white text-[#1f1d1b]"
                }`}
              >
                {p}%
              </button>
            ))}
            <button type="button" onClick={() => setMargin(est.margin_pct - 5)} className={`${SELECT} w-9 font-semibold`} aria-label="Marża minus 5%">
              −
            </button>
            <span className="w-12 text-center font-semibold tabular-nums">{est.margin_pct}%</span>
            <button type="button" onClick={() => setMargin(est.margin_pct + 5)} className={`${SELECT} w-9 font-semibold`} aria-label="Marża plus 5%">
              +
            </button>
          </div>

          {rates.extras.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold text-[#6f6c66]">Dodatki</div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {rates.extras.map((e) => (
                  <li key={e.key} className="flex items-center gap-2 text-[13px]">
                    <span className="min-w-0 flex-1">
                      {e.name} <span className="text-[11px] text-[var(--muted)]">{fmtPLN(e.price)}/{e.unit}</span>
                    </span>
                    <input
                      inputMode="decimal"
                      value={extraText[e.key] ?? ""}
                      placeholder="0"
                      onChange={(ev) => {
                        const t = ev.target.value;
                        setExtraText((x) => ({ ...x, [e.key]: t }));
                        const next = { ...choice.extras };
                        const q = num(t);
                        if (q > 0) next[e.key] = q;
                        else delete next[e.key];
                        update({ extras: next });
                      }}
                      className={NUM}
                      aria-label={`${e.name} — ilość`}
                    />
                    <span className="w-6 text-[11px] text-[#6f6c66]">{e.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasAnything && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-lg bg-[var(--surface-2)] p-2.5 text-[12px] sm:grid-cols-3">
              {(Object.keys(COST_PART_LABELS) as (keyof CostParts)[])
                .filter((k) => est.parts[k] > 0)
                .map((k) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-[#6f6c66]">{COST_PART_LABELS[k]}</dt>
                    <dd className="tabular-nums">{fmtPLN(est.parts[k])}</dd>
                  </div>
                ))}
              {est.extrasCost > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6f6c66]">Dodatki</dt>
                  <dd className="tabular-nums">{fmtPLN(est.extrasCost)}</dd>
                </div>
              )}
              <div className="col-span-full mt-1 flex justify-between gap-2 border-t border-[#ecdcbd] pt-1 font-semibold">
                <dt>Materiał brutto</dt>
                <dd className="tabular-nums">{fmtPLN(est.cost)}</dd>
              </div>
              <div className="col-span-full flex justify-between gap-2">
                <dt className="text-[#6f6c66]">Marża {est.margin_pct}% (robocizna + zysk)</dt>
                <dd className="tabular-nums">{fmtPLN(est.margin)}</dd>
              </div>
              <div className="col-span-full flex justify-between gap-2 font-semibold">
                <dt>Cena dla klienta brutto</dt>
                <dd className="tabular-nums">{fmtPLN(est.price)}</dd>
              </div>
            </dl>
          )}

          <div className="flex items-center gap-3">
            <Link href="/cennik-szafek" className="text-[12px] font-semibold text-[#a06f3f] underline-offset-2 hover:underline">
              Cennik szafek i marża
            </Link>
            <span className={`ml-auto text-[12px] ${status.error ? "text-[#b8523a]" : "text-[#6f6c66]"}`}>
              {status.error ?? status.ok ?? (dirty ? "Niezapisane" : "")}
            </span>
            <Button size="sm" type="button" onClick={save} disabled={pending || !dirty}>
              {pending ? "Zapisuję…" : "Zapisz"}
            </Button>
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Szacunek do rozmowy z klientem — bez sprzętu AGD, zlewu i baterii; drzwi przesuwne z wypełnieniem z płyty (lustro / szkło osobno). Dokładną cenę daje wycena zlecenia.
          </p>
        </div>
      )}
    </div>
  );
}
