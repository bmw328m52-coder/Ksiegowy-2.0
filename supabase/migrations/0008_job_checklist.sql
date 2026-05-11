-- ============================================================
-- Checklist projektu (kuchnia / szafa / łazienka) — pozycje per zlecenie
-- ============================================================

do $$ begin
  create type public.project_type as enum ('kitchen', 'wardrobe', 'bathroom');
exception when duplicate_object then null; end $$;

alter table public.jobs
  add column if not exists project_type public.project_type;

do $$ begin
  create type public.checklist_item_status as enum (
    'pending',     -- do zamówienia
    'ordered',     -- zamówione
    'delivered',   -- dostarczone
    'installed'    -- zamontowane
  );
exception when duplicate_object then null; end $$;

create table if not exists public.job_checklist_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  job_id            uuid not null references public.jobs(id) on delete cascade,
  category          text not null,
  label             text not null,
  qty               numeric(10, 2) not null default 1,
  unit              text not null default 'szt',
  unit_price_net    numeric(12, 2),
  vat_rate          numeric(5, 4) not null default 0.23,
  supplier          text,
  notes             text,
  status            public.checklist_item_status not null default 'pending',
  counts_in_margin  boolean not null default false,
  cost_line_id      uuid references public.cost_lines(id) on delete set null,
  order_idx         integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint job_checklist_items_qty_nonneg check (qty >= 0),
  constraint job_checklist_items_unit_price_nonneg check (unit_price_net is null or unit_price_net >= 0)
);

create index if not exists job_checklist_items_user_idx on public.job_checklist_items(user_id);
create index if not exists job_checklist_items_job_idx on public.job_checklist_items(job_id, order_idx);
create index if not exists job_checklist_items_status_idx on public.job_checklist_items(user_id, status);

drop trigger if exists job_checklist_items_updated_at on public.job_checklist_items;
create trigger job_checklist_items_updated_at
  before update on public.job_checklist_items
  for each row execute function public.set_updated_at();

alter table public.job_checklist_items enable row level security;

drop policy if exists "job_checklist_items_own_select" on public.job_checklist_items;
drop policy if exists "job_checklist_items_own_insert" on public.job_checklist_items;
drop policy if exists "job_checklist_items_own_update" on public.job_checklist_items;
drop policy if exists "job_checklist_items_own_delete" on public.job_checklist_items;

create policy "job_checklist_items_own_select" on public.job_checklist_items
  for select using (auth.uid() = user_id);
create policy "job_checklist_items_own_insert" on public.job_checklist_items
  for insert with check (auth.uid() = user_id);
create policy "job_checklist_items_own_update" on public.job_checklist_items
  for update using (auth.uid() = user_id);
create policy "job_checklist_items_own_delete" on public.job_checklist_items
  for delete using (auth.uid() = user_id);
