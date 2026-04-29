"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; info?: string };

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
