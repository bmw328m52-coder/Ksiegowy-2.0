import { createClient } from "@/lib/supabase/server";

/** Stan połączenia z KSeF bez tokena — do wyświetlania w UI. */
export type KsefStatus = {
  nip: string;
  sync_from: string;
  synced_until: string | null;
  last_sync_at: string | null;
  last_sync_added: number | null;
  last_error: string | null;
};

export async function getKsefStatus(): Promise<KsefStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ksef_connections")
    .select("nip, sync_from, synced_until, last_sync_at, last_sync_added, last_error")
    .maybeSingle();
  // Brak tabeli (migracja niewgrana) traktujemy jak „niepodłączone".
  if (error) return null;
  return (data ?? null) as KsefStatus | null;
}
