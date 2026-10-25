import { createClient } from "@supabase/supabase-js";
import { syncKsef } from "@/lib/ksef/sync";

// Codzienne automatyczne pobieranie faktur z KSeF (Vercel Cron, vercel.json).
// Działa bez zalogowanego użytkownika, więc używa klucza service-role i jest
// chronione sekretem CRON_SECRET (Vercel dokleja go do nagłówka Authorization).
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: conns, error } = await supabase.from("ksef_connections").select("user_id");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const results = [];
  for (const c of conns ?? []) {
    try {
      const r = await syncKsef(supabase, c.user_id);
      results.push({ user: c.user_id, ...r });
    } catch (e) {
      results.push({ user: c.user_id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return Response.json({ ok: true, at: new Date().toISOString(), results });
}
