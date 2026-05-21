-- ============================================================
-- Katalog materiałów (globalny per user) + materiały per pomiar
-- ============================================================

-- 1) Katalog materiałów — lista wielokrotnego użytku
create table if not exists public.material_catalog (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  unit                text not null default 'szt',
  default_price_gross numeric(12, 2),
  category            text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists material_catalog_user_idx on public.material_catalog(user_id, name);

drop trigger if exists material_catalog_updated_at on public.material_catalog;
create trigger material_catalog_updated_at
  before update on public.material_catalog
  for each row execute function public.set_updated_at();

alter table public.material_catalog enable row level security;

drop policy if exists "material_catalog_own_select" on public.material_catalog;
drop policy if exists "material_catalog_own_insert" on public.material_catalog;
drop policy if exists "material_catalog_own_update" on public.material_catalog;
drop policy if exists "material_catalog_own_delete" on public.material_catalog;

create policy "material_catalog_own_select" on public.material_catalog
  for select using (auth.uid() = user_id);
create policy "material_catalog_own_insert" on public.material_catalog
  for insert with check (auth.uid() = user_id);
create policy "material_catalog_own_update" on public.material_catalog
  for update using (auth.uid() = user_id);
create policy "material_catalog_own_delete" on public.material_catalog
  for delete using (auth.uid() = user_id);

-- 2) Materiały wybrane do konkretnego pomiaru/zlecenia
create table if not exists public.job_materials (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  job_id            uuid not null references public.jobs(id) on delete cascade,
  catalog_id        uuid references public.material_catalog(id) on delete set null,
  name              text not null,
  unit              text not null default 'szt',
  qty               numeric(12, 3) not null default 1,
  unit_price_gross  numeric(12, 2),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists job_materials_job_idx  on public.job_materials(job_id);
create index if not exists job_materials_user_idx on public.job_materials(user_id);

drop trigger if exists job_materials_updated_at on public.job_materials;
create trigger job_materials_updated_at
  before update on public.job_materials
  for each row execute function public.set_updated_at();

alter table public.job_materials enable row level security;

drop policy if exists "job_materials_own_select" on public.job_materials;
drop policy if exists "job_materials_own_insert" on public.job_materials;
drop policy if exists "job_materials_own_update" on public.job_materials;
drop policy if exists "job_materials_own_delete" on public.job_materials;

create policy "job_materials_own_select" on public.job_materials
  for select using (auth.uid() = user_id);
create policy "job_materials_own_insert" on public.job_materials
  for insert with check (auth.uid() = user_id);
create policy "job_materials_own_update" on public.job_materials
  for update using (auth.uid() = user_id);
create policy "job_materials_own_delete" on public.job_materials
  for delete using (auth.uid() = user_id);
