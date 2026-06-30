import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Cel powrotu po kliknięciu w link z maila (potwierdzenie konta / reset hasła).
// Supabase przekierowuje tutaj z parametrem `code`, który wymieniamy na sesję.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // Brak/zły kod — wróć na login z informacją.
  const fail = new URL("/login", url.origin);
  fail.searchParams.set("error", "link");
  return NextResponse.redirect(fail);
}
