// Korekta dostawcy LED 2026-06-11 (Artur): ceny taśm/zasilaczy/wyłączników/INLINE = Design Light;
// przy Belmebie zostają TYLKO profile LUMINES + klosze (4 poz., wszystkie z "LUMINES" w nazwie).
// Reguła: kat. 'Oświetlenie LED' + supplier 'Belmeb' + name NOT LIKE '%LUMINES%' → 'Design Light'.
// Idempotentny. Uruchom z meble-app: node scripts/fix-led-supplier-2026-06-11.mjs
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

// raport: wszystkie pozycje LED z aktualnym dostawcą
const listRes = await fetch(
  `${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&category=eq.${encodeURIComponent("Oświetlenie LED")}&select=name,supplier&order=name.asc`,
  { headers }
);
const before = await listRes.json();
console.log("=== LED PRZED ===");
for (const r of before) console.log(`  [${r.supplier}] ${r.name}`);

// PATCH: Belmeb + nie-LUMINES → Design Light
const patchUrl =
  `${url}/rest/v1/material_catalog` +
  `?user_id=eq.${USER_ID}` +
  `&category=eq.${encodeURIComponent("Oświetlenie LED")}` +
  `&supplier=eq.Belmeb` +
  `&name=not.like.${encodeURIComponent("*LUMINES*")}`;

const patch = await fetch(patchUrl, {
  method: "PATCH",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({ supplier: "Design Light" }),
});
if (!patch.ok) {
  console.error("❌ PATCH:", patch.status, await patch.text());
  process.exit(1);
}
const moved = await patch.json();
console.log(`\n➡️  Przeniesiono na Design Light: ${moved.length} poz.`);
for (const r of moved) console.log(`   • ${r.name}`);

// raport po
const after = await (
  await fetch(
    `${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&category=eq.${encodeURIComponent("Oświetlenie LED")}&select=name,supplier&order=supplier.asc,name.asc`,
    { headers }
  )
).json();
console.log("\n=== LED PO ===");
for (const r of after) console.log(`  [${r.supplier}] ${r.name}`);
console.log("\nGotowe.");
