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

const jobId = process.argv[2] ?? "eac09710-7550-48d1-9467-c78ed522ea3e";

const r = await fetch(
  `${url}/rest/v1/quote_briefs?job_id=eq.${jobId}&select=id,project_type,title,data,notes&order=created_at.desc&limit=1`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
);
const body = await r.json();
if (!Array.isArray(body) || body.length === 0) {
  console.log("No brief found for job", jobId);
  process.exit(0);
}
const b = body[0];
console.log("brief id:", b.id);
console.log("project_type:", b.project_type);
console.log("title:", b.title);
console.log("notes len:", (b.notes ?? "").length);
const data = b.data ?? {};
const keys = Object.keys(data);
console.log("data keys count:", keys.length);
console.log("data size (json):", JSON.stringify(data).length);
console.log("data keys:", keys.join(", "));
console.log("\n--- selected values ---");
for (const k of ["room_layout", "window_wall", "corpus_list", "corpus_color", "has_island", "room_rotation", "room_mirror"]) {
  const v = data[k];
  const display = typeof v === "string" && v.length > 200 ? v.slice(0, 200) + `... (${v.length} chars)` : JSON.stringify(v);
  console.log(`${k}: ${display}`);
}
