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

async function probe(col) {
  const r = await fetch(`${url}/rest/v1/jobs?select=${col}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await r.text();
  return { ok: r.ok, status: r.status, body };
}

for (const col of ["deposit_amount", "deposit_date"]) {
  const res = await probe(col);
  console.log(`${col}: HTTP ${res.status} ${res.ok ? "OK" : ""}`);
  if (!res.ok) console.log(`  -> ${res.body}`);
}
