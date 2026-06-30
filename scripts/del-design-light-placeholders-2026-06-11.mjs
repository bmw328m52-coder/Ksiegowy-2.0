// Usunięcie 2 starych placeholderów Design Light (ceny orientacyjne), zastąpionych realnymi pozycjami.
// Zostaje: "Zasilacz LED 24V DC 100W meblowy Design Light" (decyzja Artura 2026-06-11 — wypełnia lukę 80-150W).
// Najpierw sprawdza referencje w job_materials (catalog_id); kasuje tylko jeśli nieużywane.
// Uruchom z meble-app: node scripts/del-design-light-placeholders-2026-06-11.mjs
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

const TO_DELETE = [
  "Taśma LED COB 24V CRI90+ 4000K ~13W/m Design Light (rolka 5m)",
  "Profil aluminiowy nawierzchniowy LED Design Light 2m + klosz",
];
const q = (name) => `name=eq.${encodeURIComponent(name)}`;

for (const name of TO_DELETE) {
  const rows = await (
    await fetch(`${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&${q(name)}&select=id,name`, { headers })
  ).json();
  if (rows.length === 0) {
    console.log(`✔️  (brak / już usunięte) ${name}`);
    continue;
  }
  const id = rows[0].id;

  // sprawdź referencje w job_materials
  const refs = await (
    await fetch(`${url}/rest/v1/job_materials?catalog_id=eq.${id}&select=id`, { headers })
  ).json();
  if (Array.isArray(refs) && refs.length > 0) {
    console.log(`⛔ POMINIĘTO (używane w ${refs.length} pozycjach job_materials): ${name}`);
    continue;
  }

  const del = await fetch(`${url}/rest/v1/material_catalog?user_id=eq.${USER_ID}&${q(name)}`, {
    method: "DELETE",
    headers,
  });
  if (!del.ok) {
    console.error(`❌ DELETE ${name}: ${del.status} ${await del.text()}`);
    continue;
  }
  console.log(`🗑️  Usunięto: ${name}`);
}
console.log("\nGotowe.");
