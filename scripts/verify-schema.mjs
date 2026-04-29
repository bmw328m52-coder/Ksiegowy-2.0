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

const tables = ["clients", "jobs", "invoices", "cost_lines", "user_settings"];

let allOk = true;
for (const t of tables) {
  const r = await fetch(`${url}/rest/v1/${t}?select=count`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
  });
  const ok = r.ok;
  if (!ok) allOk = false;
  console.log(`  ${ok ? "✓" : "✗"} ${t}: HTTP ${r.status}`);
}

// Sprawdź storage bucket
const sb = await fetch(`${url}/storage/v1/bucket/invoices`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const sbj = sb.ok ? await sb.json() : null;
console.log(`  ${sb.ok ? "✓" : "✗"} storage bucket "invoices": HTTP ${sb.status} ${sbj ? `(public=${sbj.public})` : ""}`);
if (!sb.ok) allOk = false;

console.log(allOk ? "\n✅ Schema poprawnie wgrane." : "\n❌ Coś nie zadziałało — patrz wyżej.");
