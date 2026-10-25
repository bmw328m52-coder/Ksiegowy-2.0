-- ============================================================
-- KSeF — automatyczne pobieranie faktur kosztowych (Artur = nabywca).
-- Token KSeF trzymany zaszyfrowany (AES-256-GCM, klucz po stronie serwera),
-- synchronizacja przyrostowa po dacie trwałego zapisu (PermanentStorage).
-- ============================================================

create table if not exists public.ksef_connections (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  nip              text not null,
  token_enc        text not null,
  -- Od kiedy pobierać faktury przy pierwszej synchronizacji.
  sync_from        timestamptz not null,
  -- Znacznik „do tej daty wszystko pobrane" (permanentStorageHwmDate z KSeF).
  synced_until     timestamptz,
  last_sync_at     timestamptz,
  last_sync_added  integer,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.ksef_connections enable row level security;

drop policy if exists "ksef_connections_own" on public.ksef_connections;
create policy "ksef_connections_own" on public.ksef_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Numer KSeF faktury — klucz deduplikacji przy kolejnych synchronizacjach.
alter table public.invoices
  add column if not exists ksef_number text;

create unique index if not exists invoices_user_ksef_number_uq
  on public.invoices(user_id, ksef_number)
  where ksef_number is not null;
