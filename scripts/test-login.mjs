import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const r = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: "bmw328m52@gmail.com", password: "granit55" }),
  }
);

const j = await r.json();
if (r.ok && j.access_token) {
  console.log("✅ API: hasło działa. Konto można zalogować przez Supabase.");
  console.log(`   Token (skrót): ${j.access_token.slice(0, 30)}...`);
  console.log(`   User: ${j.user?.email}`);
} else {
  console.log(`❌ API: HTTP ${r.status}`);
  console.log(JSON.stringify(j, null, 2));
}
