// Wgrywa plik migracji z supabase/migrations przez Management API (bez edytora SQL w przeglądarce).
// Użycie:  SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migration.mjs 0054
// Token: https://supabase.com/dashboard/account/tokens (po użyciu — Revoke). Nie jest nigdzie zapisywany.
import { readFileSync, readdirSync } from "node:fs";

const num = process.argv[2];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!num || !token) {
  console.error("Użycie: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-migration.mjs 0054");
  process.exit(1);
}
const file = readdirSync("supabase/migrations").find((f) => f.startsWith(`${num}_`));
if (!file) {
  console.error(`Brak pliku migracji ${num}_*.sql`);
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const query = readFileSync(`supabase/migrations/${file}`, "utf8");

console.log(`Projekt ${ref} ← ${file}`);
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await r.text();
console.log(r.ok ? "OK" : `BŁĄD ${r.status}`, text.slice(0, 600));
process.exit(r.ok ? 0 : 1);
