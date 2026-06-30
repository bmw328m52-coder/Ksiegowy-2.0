// Aventos HF — środkowy komplet H-560-710mm (decyzja Artura 2026-06-12).
// Merkury nie listuje siłownika 20F2500.05, więc cena kompletu = POŚREDNIA (średnia)
// między sąsiednimi kompletami: (335,92 + 394,24)/2 = 365,08 zł.
// Zamienia dotychczasowy wpis "TYLKO RAMIĘ" (20F3500) na pełny komplet.
// Idempotentny. Uruchom z katalogu meble-app: node scripts/add-aventos-hf-mid-2026-06-12.mjs
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
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const OLD_RAMIE = "Zestaw podnośników Aventos HF Blum 20F3500 H-560-710mm (TYLKO RAMIĘ)";
const KOMPLET = "KOMPLET Aventos HF H-560-710mm: ramię 20F3500 + siłownik 20F2500.05 + zaślepki 20F8020";
const NOTES =
  "Ramię 20F3500 (110,81) + siłownik 20F2500.05 moc 5350-10150 + zaślepki 20F8020 L+P (35,36). " +
  "Merkury nie listuje siłownika 20F2500.05, więc cena kompletu = pośrednia (średnia) między " +
  "H-480-570 (335,92) a H-700-900 (394,24) = 365,08. Decyzja Artura 2026-06-12.";
const PRICE = 365.08;

const q = (name) => `name=eq.${encodeURIComponent(name)}`;

async function get(name) {
  const r = await fetch(
    `${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&${q(name)}&select=id,name,unit,default_price_gross,category`,
    { headers }
  );
  return r.json();
}

console.log("=== STAN PRZED ===");
for (const n of [OLD_RAMIE, KOMPLET]) {
  const r = (await get(n))[0];
  console.log(r ? `  • ${r.name} — ${Number(r.default_price_gross).toFixed(2)} zł` : `  • (brak) ${n}`);
}

// 1) usuń stary wpis "TYLKO RAMIĘ" (zastępujemy go kompletem)
if ((await get(OLD_RAMIE)).length > 0) {
  const del = await fetch(`${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&${q(OLD_RAMIE)}`, {
    method: "DELETE",
    headers,
  });
  if (!del.ok) throw new Error(`DELETE ramię: ${del.status} ${await del.text()}`);
  console.log(`🗑️  Usunięto wpis "TYLKO RAMIĘ".`);
} else {
  console.log(`✔️  Wpisu "TYLKO RAMIĘ" już nie ma (pominięto).`);
}

// 2) dodaj/odśwież komplet środkowy
const existing = await get(KOMPLET);
if (existing.length === 0) {
  const ins = await fetch(`${url}/rest/v1/material_catalog`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify([
      {
        user_id: USER_ID,
        name: KOMPLET,
        unit: "kpl",
        default_price_gross: PRICE,
        category: "Aventos",
        notes: NOTES,
      },
    ]),
  });
  if (!ins.ok) throw new Error(`INSERT komplet: ${ins.status} ${await ins.text()}`);
  console.log(`➕ Dodano: ${KOMPLET} — ${PRICE.toFixed(2)} zł / kpl`);
} else {
  const upd = await fetch(`${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&${q(KOMPLET)}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ default_price_gross: PRICE, category: "Aventos", notes: NOTES }),
  });
  if (!upd.ok) throw new Error(`PATCH komplet: ${upd.status} ${await upd.text()}`);
  console.log(`💰 Komplet już był — zaktualizowano cenę do ${PRICE.toFixed(2)} zł.`);
}

console.log("\n=== STAN PO ===");
for (const n of [OLD_RAMIE, KOMPLET]) {
  const r = (await get(n))[0];
  console.log(r ? `  • ${r.name} — ${Number(r.default_price_gross).toFixed(2)} zł` : `  • (brak) ${n}`);
}
console.log("\nGotowe.");
