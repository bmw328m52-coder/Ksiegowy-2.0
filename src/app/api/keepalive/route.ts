import { createClient } from "@supabase/supabase-js";

// Budzik dla Supabase: darmowy projekt usypia po ~7 dniach bez zapytań.
// Vercel Cron woła ten endpoint codziennie (vercel.json) — jedno lekkie
// zapytanie do Postgresa wystarcza, żeby baza nie zasnęła. Klucz anon + RLS
// = zero danych w odpowiedzi, ale zapytanie i tak trafia do bazy.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { error } = await supabase.from("clients").select("id", { head: true, count: "exact" }).limit(1);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, at: new Date().toISOString() });
}
