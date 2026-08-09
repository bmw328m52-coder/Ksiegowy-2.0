-- ============================================================
-- Moduł FINANSE — dokumenty (status płatności + status księgowy ING)
-- oraz terminy urzędowe. LUVIANO = kontrola, ING = prawda księgowa.
-- ============================================================

-- ------------------------------------------------------------
-- DOKUMENTY: fakty płatności + status przekazania do ING
-- (osobno od interpretacji podatkowej — kolumny opisują FAKTY)
-- ------------------------------------------------------------
alter table public.invoices
  add column if not exists paid_date        date,
  add column if not exists payment_status   text not null default 'unpaid',   -- 'unpaid' | 'paid'
  add column if not exists payment_method   text,                              -- 'transfer' | 'card' | 'cash' | 'blik' | ...
  add column if not exists doc_source       text,                             -- 'ksef' | 'pdf' | 'photo' | 'receipt' | 'manual' | 'other'
  add column if not exists accounting_status text not null default 'not_sent'; -- 'not_sent' | 'ready' | 'entered' | 'verified'

-- Indeksy pod widoki „Księgowość" i „Wymaga uwagi"
create index if not exists invoices_accounting_idx on public.invoices(user_id, accounting_status);
create index if not exists invoices_payment_idx    on public.invoices(user_id, payment_status);

-- ------------------------------------------------------------
-- TERMINY urzędowe (konfigurowalne encje — obok terminów
-- podatkowych liczonych dynamicznie w lib/taxDeadlines.ts)
-- ------------------------------------------------------------
create table if not exists public.deadlines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  category    text not null default 'inne',   -- 'zus' | 'pit' | 'vat' | 'jpk' | 'ksef' | 'inne'
  due_date    date not null,
  done        boolean not null default false,
  note        text,
  doc_url     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists deadlines_user_idx on public.deadlines(user_id, due_date);
create index if not exists deadlines_open_idx  on public.deadlines(user_id, done, due_date);

drop trigger if exists deadlines_updated_at on public.deadlines;
create trigger deadlines_updated_at
  before update on public.deadlines
  for each row execute function public.set_updated_at();

alter table public.deadlines enable row level security;

drop policy if exists "deadlines_own_select" on public.deadlines;
drop policy if exists "deadlines_own_insert" on public.deadlines;
drop policy if exists "deadlines_own_update" on public.deadlines;
drop policy if exists "deadlines_own_delete" on public.deadlines;

create policy "deadlines_own_select" on public.deadlines for select using (auth.uid() = user_id);
create policy "deadlines_own_insert" on public.deadlines for insert with check (auth.uid() = user_id);
create policy "deadlines_own_update" on public.deadlines for update using (auth.uid() = user_id);
create policy "deadlines_own_delete" on public.deadlines for delete using (auth.uid() = user_id);
