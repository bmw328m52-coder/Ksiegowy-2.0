"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { JobMaterial } from "@/lib/dao/material_catalog";
import { fmtPLN } from "@/lib/format";

// Wspólny, klientowy stan materiałów wyceny. Seedowany danymi z serwera, ale od
// tego momentu to ON jest źródłem prawdy dla UI — dlatego dodawanie/usuwanie/zmiana
// ilości i wszystkie sumy (grupy + górna karta) aktualizują się natychmiast,
// niezależnie od tego czy router.refresh odświeży serwer (w prod/PWA bywa, że nie).

type Store = {
  materials: JobMaterial[];
  add: (row: JobMaterial) => void;
  remove: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
};

const Ctx = createContext<Store | null>(null);

export function MaterialsStoreProvider({
  initial,
  children,
}: {
  initial: JobMaterial[];
  children: ReactNode;
}) {
  const [materials, setMaterials] = useState<JobMaterial[]>(initial);
  const store = useMemo<Store>(
    () => ({
      materials,
      add: (row) =>
        setMaterials((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row])),
      remove: (id) => setMaterials((prev) => prev.filter((m) => m.id !== id)),
      updateQty: (id, qty) =>
        setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, qty } : m))),
    }),
    [materials]
  );
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useMaterialsStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useMaterialsStore użyty poza <MaterialsStoreProvider>");
  return s;
}

function sumPrice(list: JobMaterial[]): number {
  return list.reduce(
    (acc, m) => (m.unit_price_gross === null ? acc : acc + m.qty * m.unit_price_gross),
    0
  );
}

// Pozycje należące do wskazanych group_key (jedna grupa wyceny lub jej scalenia).
export function useGroupItems(keys: string[]): JobMaterial[] {
  const { materials } = useMaterialsStore();
  return materials.filter((m) => m.group_key !== null && keys.includes(m.group_key));
}

// Materiały luźne (bez group_key).
export function useLooseItems(): JobMaterial[] {
  const { materials } = useMaterialsStore();
  return materials.filter((m) => m.group_key === null);
}

// Suma brutto pozycji o wskazanych group_key — do „Razem grupa".
export function GroupTotal({ keys }: { keys: string[] }) {
  const items = useGroupItems(keys);
  return <span className="text-sm font-semibold tabular-nums">{fmtPLN(sumPrice(items))}</span>;
}

// Górna karta: Pozycje (group_key != null) + Materiały (group_key == null) + Razem.
export function WycenaTotals() {
  const { materials } = useMaterialsStore();
  let itemsTotal = 0;
  let materialsTotal = 0;
  for (const m of materials) {
    if (m.unit_price_gross === null) continue;
    const v = m.qty * m.unit_price_gross;
    if (m.group_key === null) materialsTotal += v;
    else itemsTotal += v;
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-zinc-500">Pozycje</p>
          <p className="font-medium text-sm tabular-nums">{fmtPLN(itemsTotal)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Materiały</p>
          <p className="font-medium text-sm tabular-nums">{fmtPLN(materialsTotal)}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-100 flex items-baseline justify-between">
        <span className="text-zinc-500 text-sm">Razem brutto</span>
        <span className="font-semibold text-lg tabular-nums">{fmtPLN(itemsTotal + materialsTotal)}</span>
      </div>
    </>
  );
}
