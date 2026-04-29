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

async function testSupabase() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return console.log("Supabase: SKIP (brak URL lub klucza)");
  try {
    const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key } });
    console.log(`Supabase REST: HTTP ${r.status} ${r.ok ? "OK" : ""}`);
    const auth = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    console.log(`Supabase Auth: HTTP ${auth.status}`);
  } catch (e) {
    console.log("Supabase: BŁĄD", e.message);
  }
}

async function testAnthropic() {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return console.log("Anthropic: SKIP (brak klucza)");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok) console.log(`Anthropic: OK (model=${j?.model}, użyto tokenów: ${j?.usage?.output_tokens})`);
    else console.log(`Anthropic: HTTP ${r.status}`, j?.error?.message ?? "");
  } catch (e) {
    console.log("Anthropic: BŁĄD", e.message);
  }
}

await testSupabase();
await testAnthropic();
