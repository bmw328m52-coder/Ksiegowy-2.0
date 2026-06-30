// Jednorazowy import oświetlenia LED do material_catalog (żywa Supabase, SERVICE_ROLE).
// Ceny taśm/zasilaczy/wyłączników/profilu INLINE = Design Light (podane przez Artura);
// profile LUMINES + klosze = Belmeb (doczytane z belmeb.pl). Dostawca nadawany per nazwa.
// Idempotentny: pomija pozycje o istniejącej nazwie. Uruchom: node scripts/import-belmeb-led.mjs
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
const CAT = "Oświetlenie LED";
// Dostawca per pozycja: profile LUMINES + klosze = Belmeb; reszta = Design Light.
const supplierFor = (name) => (name.includes("LUMINES") ? "Belmeb" : "Design Light");

// [name, unit, price_gross, notes]
const ITEMS = [
  ["Taśma COB BICOLOR 608 LED/m IP65 14,8W/m 24V DC (rolka 5m)", "rolka 5m", 120.0,
    "Belmeb. 24V, bicolor (regulowana barwa), IP65, 14,8W/m, 608 LED/m. Cena za rolkę 5m (potwierdzone 2026-06-11)."],
  ["Taśma COB 480 LED/m IP20 12,8W/m 24V DC (rolka 5m)", "rolka 5m", 99.0,
    "Belmeb. 24V IP20 12,8W/m 480 LED/m. Rolka 5m (25m=475 zł → ~19 zł/m). Pod szafki wybierz 4000K."],
  ["Taśma COB 480 LED/m IP20 12,8W/m 24V DC (rolka 25m)", "rolka 25m", 475.0,
    "Belmeb. 24V IP20 12,8W/m 480 LED/m. Rolka 25m (~19 zł/m)."],
  ["Taśma LED Neon Flex Slim 4x8mm IP67 6,2W/m 24V DC (rolka 5m)", "rolka 5m", 75.8,
    "Belmeb. 24V IP67 6,2W/m, Neon Flex Slim 4x8mm. Rolka 5m (25m=379 zł → ~15,2 zł/m)."],
  ["Taśma LED Neon Flex Slim 4x8mm IP67 6,2W/m 24V DC (rolka 25m)", "rolka 25m", 379.0,
    "Belmeb. 24V IP67 6,2W/m Neon Flex Slim 4x8mm. Rolka 25m (~15,2 zł/m)."],
  ["Taśma LED Neon Flex IP65 12W/m 24V DC PREMIUM (rolka 5m)", "rolka 5m", 169.0,
    "Belmeb. PREMIUM. 24V IP65 12W/m Neon Flex. Cena za rolkę 5m (potwierdzone 2026-06-11; 25m=757 zł → ~30,3 zł/m)."],
  ["Taśma LED Neon Flex IP65 12W/m 24V DC PREMIUM (rolka 25m)", "rolka 25m", 757.0,
    "Belmeb. PREMIUM. 24V IP65 12W/m Neon Flex. Rolka 25m (~30,3 zł/m)."],
  ["Zasilacz LED 24V DC 33W STANDARD PLUS", "szt", 44.0,
    "Belmeb. Zasilacz LED 24V DC 33W, seria STANDARD PLUS. Cena podana przez Artura 2026-06-11."],
  ["Zasilacz LED 24V DC 54W STANDARD PLUS", "szt", 65.0, "Belmeb. Zasilacz LED 24V DC 54W, seria STANDARD PLUS."],
  ["Zasilacz LED 24V DC 80W STANDARD PLUS", "szt", 89.0, "Belmeb. Zasilacz LED 24V DC 80W, seria STANDARD PLUS."],
  ["Zasilacz do LED PREMIUM 24V DC 150W", "szt", 159.0, "Belmeb. Zasilacz LED PREMIUM 24V DC 150W. Dobór mocy: suma W taśmy + ~20% zapasu."],
  ["Wyłącznik podblatowy ze ściemniaczem", "szt", 57.0, "Belmeb. Wyłącznik podblatowy ze ściemniaczem do systemów LED."],
  ["Wyłącznik przyciskowy ze ściemniaczem W02", "szt", 35.9, "Belmeb. Wyłącznik przyciskowy ze ściemniaczem, model W02."],
  ["Wyłącznik XC60 dotykowy profilowy", "szt", 29.0, "Belmeb. Wyłącznik dotykowy XC60 montowany w profilu LED."],
  ["Profil aluminiowy INLINE 2 m", "szt", 30.9, "Belmeb. Profil aluminiowy INLINE, dł. 2m."],
  ["Profil LED LUMINES wpuszczany B, srebrny anodowany, 3,00 mb", "szt", 40.1,
    "Belmeb. Kod 03.PROF.LUMINES.B3.AL. Profil wpuszczany (frezowany), min. głębokość 9mm. Dł. 3m. Klosz osobno."],
  ["Profil LED LUMINES wpuszczany B, czarny, 3,00 mb", "szt", 48.39,
    "Belmeb. Kod 03.PROF.LUMINES.B3.CZ. Profil wpuszczany (frezowany). Dł. 3m. Klosz osobno."],
  ["Klosz nakładany do profilu LUMINES, mleczny, 3,00 mb", "szt", 7.91,
    "Belmeb. Klosz nakładany (wciskany od góry) do profilu LUMINES B. Dł. 3m. Cena z belmeb.pl 2026-06-10."],
  ["Klosz nakładany do profilu LUMINES, czarny, 3,00 mb", "szt", 23.6,
    "Belmeb. Klosz nakładany do profilu LUMINES B. Dł. 3m. Cena z belmeb.pl 2026-06-10."],
];

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// 1) Pobierz istniejące nazwy (idempotencja).
const existRes = await fetch(
  `${url}/rest/v1/material_catalog?select=name&user_id=eq.${USER_ID}`,
  { headers }
);
const existing = new Set((await existRes.json()).map((r) => r.name));

const toInsert = ITEMS
  .filter(([name]) => !existing.has(name))
  .map(([name, unit, price, notes]) => ({
    user_id: USER_ID,
    name,
    unit,
    default_price_gross: price,
    category: CAT,
    supplier: supplierFor(name),
    notes,
  }));

const skipped = ITEMS.length - toInsert.length;
console.log(`Pozycji łącznie: ${ITEMS.length}, do wstawienia: ${toInsert.length}, pominięto (już są): ${skipped}`);

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
  console.error("❌ Błąd insertu:", ins.status, await ins.text());
  process.exit(1);
}

const rows = await ins.json();
console.log(`✅ Wstawiono ${rows.length} pozycji LED (Belmeb):`);
for (const r of rows) console.log(`   • ${r.name} — ${Number(r.default_price_gross).toFixed(2)} zł / ${r.unit}`);
