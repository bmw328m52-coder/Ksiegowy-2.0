import type {
  BlatOption,
  BoardOption,
  FrontOption,
  HandleOption,
  ModuleDef,
} from "./catalog";
import { PRICES as DEFAULT_PRICES } from "./catalog";

export type Prices = typeof DEFAULT_PRICES;

export type ModuleCost = {
  /** koszt korpusu (płyta + plecy + okleina + okucia + nogi) */
  korpus: number;
  /** koszt fronta */
  front: number;
  /** koszt uchwytów dla tego modułu */
  uchwyty: number;
  /** robocizna dla tego modułu w minutach */
  labor_min: number;
  /** koszt łączny pojedynczego modułu (bez robocizny i marży) */
  total: number;
};

/** Wycenia pojedynczy moduł na podstawie wybranych materiałów. */
export function costOfModule(
  m: ModuleDef,
  board: BoardOption,
  front: FrontOption,
  handle: HandleOption,
  prices: Prices = DEFAULT_PRICES,
): ModuleCost {
  const korpus =
    m.bom.plyta_m2 * board.price_m2 +
    m.bom.hdf_m2 * prices.hdf_m2 +
    m.bom.okleina_2mm_mb * prices.okleina_2mm_mb +
    m.bom.okleina_04mm_mb * prices.okleina_04mm_mb +
    m.bom.zawiasy * prices.zawias_szt +
    m.bom.prowadnice * prices.prowadnica_komplet +
    m.bom.nogi * prices.noga_szt;

  const frontCost = m.bom.fronty_m2 * front.price_m2;
  const uchwytyCost = m.bom.uchwyty * handle.price_szt;

  return {
    korpus,
    front: frontCost,
    uchwyty: uchwytyCost,
    labor_min: m.labor_min,
    total: korpus + frontCost + uchwytyCost,
  };
}

export type Selection = { code: string; qty: number };

export type Breakdown = {
  modulesNet: number;
  blatNet: number;
  laborNet: number;
  laborHours: number;
  /** koszt własny netto (materiał + blat + robocizna) */
  costNet: number;
  marginAmount: number;
  /** cena dla klienta netto */
  priceNet: number;
  vatAmount: number;
  /** cena dla klienta brutto */
  priceGross: number;
  /** zysk (cena netto − koszt netto) */
  profit: number;
};

export type CalcInput = {
  selections: Selection[];
  modules: ModuleDef[];
  board: BoardOption;
  front: FrontOption;
  handle: HandleOption;
  blat: BlatOption | null;
  blat_mb: number;
  /** stawka robocizny PLN/h netto (twój koszt — własna praca) */
  laborRatePerHour: number;
  /** marża jako mnożnik np. 0.35 = +35% */
  marginPct: number;
  /** VAT jako ułamek 0.23 */
  vatRate: number;
  /** Ceny slotów (HDF, okleina, zawias, prowadnica, noga). Domyślnie hardcoded z catalog.ts. */
  prices?: Prices;
};

export function calcKitchen(input: CalcInput): Breakdown {
  let modulesNet = 0;
  let laborMin = 0;
  const prices = input.prices ?? DEFAULT_PRICES;

  for (const sel of input.selections) {
    if (sel.qty <= 0) continue;
    const m = input.modules.find((x) => x.code === sel.code);
    if (!m) continue;
    const c = costOfModule(m, input.board, input.front, input.handle, prices);
    modulesNet += c.total * sel.qty;
    laborMin += c.labor_min * sel.qty;
  }

  const blatNet = input.blat ? input.blat.price_mb * input.blat_mb : 0;
  const laborHours = laborMin / 60;
  const laborNet = laborHours * input.laborRatePerHour;

  const costNet = modulesNet + blatNet + laborNet;
  const priceNet = costNet * (1 + input.marginPct);
  const marginAmount = priceNet - costNet;
  const vatAmount = priceNet * input.vatRate;
  const priceGross = priceNet + vatAmount;
  const profit = priceNet - costNet;

  return {
    modulesNet,
    blatNet,
    laborNet,
    laborHours,
    costNet,
    marginAmount,
    priceNet,
    vatAmount,
    priceGross,
    profit,
  };
}
