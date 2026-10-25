"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authenticateWithToken } from "@/lib/ksef/client";
import { encryptSecret } from "@/lib/ksef/secret";
import { syncKsef } from "@/lib/ksef/sync";

export type KsefActionState = { error?: string; ok?: string };

export async function connectKsefAction(_prev: KsefActionState, formData: FormData): Promise<KsefActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Brak sesji." };

  const token = String(formData.get("token") ?? "").trim();
  const nip = String(formData.get("nip") ?? "").replace(/\D/g, "");
  const syncFrom = String(formData.get("sync_from") ?? "").trim();
  if (!token) return { error: "Wklej token KSeF." };
  if (nip.length !== 10) return { error: "NIP musi mieć 10 cyfr." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(syncFrom)) return { error: "Podaj datę, od której pobierać faktury." };

  // Najpierw sprawdzamy, czy token działa — nie zapisujemy niedziałającego.
  try {
    await authenticateWithToken(token, nip);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się zalogować do KSeF." };
  }

  const { error } = await supabase.from("ksef_connections").upsert({
    user_id: user.id,
    nip,
    token_enc: encryptSecret(token),
    sync_from: new Date(`${syncFrom}T00:00:00+02:00`).toISOString(),
    synced_until: null,
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  // NIP firmy w ustawieniach — uzupełniamy, jeśli był pusty.
  await supabase.from("user_settings").update({ business_nip: nip }).eq("user_id", user.id).is("business_nip", null);

  revalidatePath("/settings");
  revalidatePath("/invoices");
  return { ok: "Połączono z KSeF. Możesz pobrać faktury." };
}

export async function disconnectKsefAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("ksef_connections").delete().eq("user_id", user.id);
  revalidatePath("/settings");
  revalidatePath("/invoices");
}

export async function syncKsefAction(_prev: KsefActionState): Promise<KsefActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Brak sesji." };

  try {
    const r = await syncKsef(supabase, user.id);
    revalidatePath("/invoices");
    revalidatePath("/finanse");
    revalidatePath("/dashboard");
    revalidatePath("/invoices/sprzedaz");
    revalidatePath("/jobs");
    revalidatePath("/");
    const parts = [
      r.added === 0 ? "Brak nowych faktur kosztowych" : `Kosztowe: +${r.added}`,
      r.linked > 0 ? `${r.linked} połączono z już wgranymi` : null,
      r.sales && r.sales.added > 0
        ? `Sprzedażowe: +${r.sales.added}${r.sales.matched ? ` (${r.sales.matched} przypięto do zleceń)` : ""}`
        : null,
      r.more || r.sales?.more ? "są kolejne — kliknij jeszcze raz" : null,
    ].filter(Boolean);
    return { ok: parts.join(" · ") + "." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Błąd synchronizacji z KSeF." };
  }
}
