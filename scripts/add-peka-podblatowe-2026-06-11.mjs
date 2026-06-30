// Dodanie cargo podblatowych Peka (SLIM ARENA / SNELLO / Junior ARENA).
// Ceny BRUTTO zakupowe podane przez Artura 2026-06-11. supplier='Peka', category='Kosze cargo podblatowe'.
// Idempotentny po nazwie. Uruchom z meble-app: node scripts/add-peka-podblatowe-2026-06-11.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = "adc4b3e0-757f-45e4-9c97-b24d5313db11";
const CAT = "Kosze cargo podblatowe";
const SUP = "Peka";
const NOTE = "Peka. Cena zakupowa BRUTTO podana przez Artura 2026-06-11.";
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const ITEMS = [
  ["Cargo podblatowe SLIM ARENA Classic 610 / 300 / 2 kosze, białe", 904.51],
  ["Cargo podblatowe SNELLO 300, białe", 777.0],
  ["Cargo podblatowe Junior ARENA Classic Silver / 300, szare", 811.0],
];

const existing = new Set(
  (await (await fetch(`${url}/rest/v1/material_catalog?select=name&user_id=eq.${USER_ID}`, { headers })).json()).map((r) => r.name)
);

const toInsert = ITEMS.filter(([n]) => !existing.has(n)).map(([name, price]) => ({
  user_id: USER_ID,
  name,
  unit: "kpl",
  default_price_gross: price,
  category: CAT,
  supplier: SUP,
  notes: NOTE,
}));

console.log(`Łącznie ${ITEMS.length}, do wstawienia ${toInsert.length}, pominięto ${ITEMS.length - toInsert.length}.`);
if (toInsert.length === 0) {
  console.log("Nic do wstawienia.");
  process.exit(0);
}

const ins = await fetch(`${url}/rest/v1/material_catalog`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify(toInsert),
});
if (!ins.ok) {
  console.error("❌ INSERT:", ins.status, await ins.text());
  process.exit(1);
}
for (const r of await ins.json()) console.log(`✅ ${r.name} — ${Number(r.default_price_gross).toFixed(2)} zł / ${r.unit} [${r.supplier}]`);
