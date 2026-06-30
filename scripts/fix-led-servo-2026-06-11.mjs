// Korekty cennika 2026-06-11 (potwierdzone przez Artura):
//  1) Zasilacz 24W/37 zł NIE ISTNIEJE → usunąć; w zamian Zasilacz LED 24V DC 33W STANDARD PLUS 44,00 zł.
//  2) Servo-Drive UNO Z10UB00EE: cena 570 → 460 zł (zdejmujemy "do weryfikacji").
//  3) Taśma COB BICOLOR 608 i Neon Flex IP65 PREMIUM: rolka 5m POTWIERDZONA → zdjąć "DŁUGOŚĆ DO POTWIERDZENIA".
// Idempotentny. Uruchom z katalogu meble-app: node scripts/fix-led-servo-2026-06-11.mjs
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

const OLD_ZASILACZ = "Zasilacz LED 24V DC 24W STANDARD PLUS";
const NEW_ZASILACZ = "Zasilacz LED 24V DC 33W STANDARD PLUS";
const SERVO = "Zestaw Servo-Drive UNO do stojących sortowników na śmieci (NOWA WERSJA) Blum Z10UB00EE";
const COB_BICOLOR = "Taśma COB BICOLOR 608 LED/m IP65 14,8W/m 24V DC (rolka 5m)";
const NEON_IP65 = "Taśma LED Neon Flex IP65 12W/m 24V DC PREMIUM (rolka 5m)";

const q = (name) => `name=eq.${encodeURIComponent(name)}`;

async function get(name) {
  const r = await fetch(
    `${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&${q(name)}&select=id,name,unit,default_price_gross,notes`,
    { headers }
  );
  return r.json();
}
async function patch(name, body) {
  const r = await fetch(`${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&${q(name)}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${name}: ${r.status} ${await r.text()}`);
  return r.json();
}

// --- 0) raport stanu przed ---
console.log("=== STAN PRZED ===");
for (const n of [OLD_ZASILACZ, NEW_ZASILACZ, SERVO, COB_BICOLOR, NEON_IP65]) {
  const rows = await get(n);
  const r = rows[0];
  console.log(r ? `  • ${r.name} — ${Number(r.default_price_gross).toFixed(2)} zł / ${r.unit}` : `  • (brak) ${n}`);
}

// --- 1) zasilacz: usuń 24W, dodaj 33W ---
const old24 = await get(OLD_ZASILACZ);
if (old24.length > 0) {
  const del = await fetch(`${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&${q(OLD_ZASILACZ)}`, {
    method: "DELETE",
    headers,
  });
  if (!del.ok) throw new Error(`DELETE 24W: ${del.status} ${await del.text()}`);
  console.log(`🗑️  Usunięto: ${OLD_ZASILACZ}`);
} else {
  console.log(`✔️  24W już go nie ma (pominięto usuwanie).`);
}

const new33 = await get(NEW_ZASILACZ);
if (new33.length === 0) {
  const ins = await fetch(`${url}/rest/v1/material_catalog`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify([{
      user_id: USER_ID,
      name: NEW_ZASILACZ,
      unit: "szt",
      default_price_gross: 44.0,
      category: "Oświetlenie LED",
      supplier: "Belmeb",
      notes: "Belmeb. Zasilacz LED 24V DC 33W, seria STANDARD PLUS. Cena podana przez Artura 2026-06-11.",
    }]),
  });
  if (!ins.ok) throw new Error(`INSERT 33W: ${ins.status} ${await ins.text()}`);
  console.log(`➕ Dodano: ${NEW_ZASILACZ} — 44,00 zł / szt`);
} else {
  console.log(`✔️  33W już jest (pominięto dodawanie).`);
}

// --- 2) Servo-Drive UNO → 460 zł ---
await patch(SERVO, {
  default_price_gross: 460.0,
  notes: "Następca Z10NA30EE. Cena zakupowa 460 zł (potwierdzona przez Artura 2026-06-11).",
});
console.log(`💰 Servo-Drive UNO → 460,00 zł`);

// --- 3) zdejmij "DŁUGOŚĆ DO POTWIERDZENIA" ---
await patch(COB_BICOLOR, {
  notes: "Belmeb. 24V, bicolor (regulowana barwa), IP65, 14,8W/m, 608 LED/m. Cena za rolkę 5m (potwierdzone 2026-06-11).",
});
await patch(NEON_IP65, {
  notes: "Belmeb. PREMIUM. 24V IP65 12W/m Neon Flex. Cena za rolkę 5m (potwierdzone 2026-06-11; 25m=757 zł → ~30,3 zł/m).",
});
console.log(`✅ Zdjęto "DŁUGOŚĆ DO POTWIERDZENIA" z COB BICOLOR i Neon Flex IP65.`);

// --- raport po ---
console.log("\n=== STAN PO ===");
for (const n of [NEW_ZASILACZ, SERVO, COB_BICOLOR, NEON_IP65]) {
  const rows = await get(n);
  const r = rows[0];
  console.log(r ? `  • ${r.name} — ${Number(r.default_price_gross).toFixed(2)} zł / ${r.unit}` : `  • (brak) ${n}`);
}
console.log("\nGotowe.");
