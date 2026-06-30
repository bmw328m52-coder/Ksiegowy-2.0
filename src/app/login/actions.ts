"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; info?: string };

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function signIn(_prev: Result, formData: FormData): Promise<Result> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Podaj e-mail i hasło." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message) };

  const next = String(formData.get("next") ?? "/");
  redirect(next || "/");
}

export async function signUp(_prev: Result, formData: FormData): Promise<Result> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Podaj e-mail i hasło." };
  if (password.length < 8) return { error: "Hasło musi mieć co najmniej 8 znaków." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: friendly(error.message) };

  if (data.user && !data.session) {
    return { info: "Konto utworzone. Sprawdź skrzynkę e-mail i potwierdź adres, a potem zaloguj się." };
  }

  redirect("/");
}

export async function requestPasswordReset(_prev: Result, formData: FormData): Promise<Result> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Podaj e-mail." };

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: friendly(error.message) };

  // Nie zdradzamy, czy konto istnieje — zawsze ten sam komunikat.
  return { info: "Jeśli konto istnieje, wysłaliśmy link do zmiany hasła. Sprawdź skrzynkę." };
}

export async function updatePassword(_prev: Result, formData: FormData): Promise<Result> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Hasło musi mieć co najmniej 8 znaków." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Link wygasł lub jest nieprawidłowy. Poproś o nowy link do resetu." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendly(error.message) };

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Nieprawidłowy e-mail lub hasło.";
  if (m.includes("email") && m.includes("confirm")) return "Najpierw potwierdź e-mail (sprawdź skrzynkę).";
  if (m.includes("already registered")) return "Konto na ten e-mail już istnieje. Zaloguj się.";
  if (m.includes("rate limit")) return "Za dużo prób. Poczekaj chwilę i spróbuj ponownie.";
  return msg;
}
