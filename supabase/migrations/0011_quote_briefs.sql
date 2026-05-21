-- ============================================================
-- Brief pomiarowy / wstępna wycena — Q&A na wizycie u klienta
-- ============================================================

do $$ begin
  create type public.quote_brief_status as enum (
    'draft',      -- robione na pomiarze
    'sent',       -- wycena wysłana klientowi
    'accepted',   -- klient zaakceptował
    'rejected',   -- klient odrzucił
    'converted'   -- utworzono zlecenie z briefu
  );
exception when duplicate_object then null; end $$;

create table if not exists public.quote_briefs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete cascade,
  project_type      public.project_type not null,
  title             text not null,
  visit_date        date,
  status            public.quote_brief_status not null default 'draft',
  data              jsonb not null default '{}'::jsonb,
  estimated_amount  numeric(12, 2),
  notes             text,
  job_id            uuid references public.jobs(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists quote_briefs_user_idx     on public.quote_briefs(user_id);
create index if not exists quote_briefs_client_idx   on public.quote_briefs(client_id);
create index if not exists quote_briefs_status_idx   on public.quote_briefs(user_id, status);
create index if not exists quote_briefs_visit_idx    on public.quote_briefs(user_id, visit_date desc);

drop trigger if exists quote_briefs_updated_at on public.quote_briefs;
create trigger quote_briefs_updated_at
  before update on public.quote_briefs
  for each row execute function public.set_updated_at();

alter table public.quote_briefs enable row level security;

drop policy if exists "quote_briefs_own_select" on public.quote_briefs;
drop policy if exists "quote_briefs_own_insert" on public.quote_briefs;
drop policy if exists "quote_briefs_own_update" on public.quote_briefs;
drop policy if exists "quote_briefs_own_delete" on public.quote_briefs;

create policy "quote_briefs_own_select" on public.quote_briefs
  for select using (auth.uid() = user_id);
create policy "quote_briefs_own_insert" on public.quote_briefs
  for insert with check (auth.uid() = user_id);
create policy "quote_briefs_own_update" on public.quote_briefs
  for update using (auth.uid() = user_id);
create policy "quote_briefs_own_delete" on public.quote_briefs
  for delete using (auth.uid() = user_id);
