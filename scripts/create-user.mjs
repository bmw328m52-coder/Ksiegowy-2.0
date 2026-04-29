import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error("Użycie: node scripts/create-user.mjs <email> <hasło>");
  process.exit(1);
}

const r = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ email, password, email_confirm: true }),
});

const j = await r.json();
if (r.ok) {
  console.log(`✅ Konto utworzone. ID: ${j.id}`);
  console.log(`   E-mail: ${j.email}`);
  console.log(`   Potwierdzony: ${j.email_confirmed_at ? "tak" : "nie"}`);
} else {
  console.error(`❌ Błąd: HTTP ${r.status}`);
  console.error(JSON.stringify(j, null, 2));
  process.exit(1);
}
