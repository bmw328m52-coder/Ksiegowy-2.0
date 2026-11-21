-- ============================================================
-- Projekty kuchni (Projektant kuchni w meble-app).
-- data  — KitchenProject z src/lib/kitchen/types.ts (rozstaw szafek na ścianach ze skanu)
-- quote — migawka wyceny (KitchenQuoteSnapshot) liczona z cennika w chwili zapisu
-- scan_id: skan, z którego wzięto geometrię (po jego usunięciu projekt zostaje).
-- ============================================================

create table if not exists public.kitchen_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  scan_id     uuid references public.room_scans(id) on delete set null,
  name        text not null default 'Kuchnia',
  data        jsonb not null,
  quote       jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists kitchen_projects_job_idx on public.kitchen_projects(job_id, updated_at desc);

alter table public.kitchen_projects enable row level security;

drop policy if exists "kitchen_projects_own_select" on public.kitchen_projects;
drop policy if exists "kitchen_projects_own_insert" on public.kitchen_projects;
drop policy if exists "kitchen_projects_own_update" on public.kitchen_projects;
drop policy if exists "kitchen_projects_own_delete" on public.kitchen_projects;

create policy "kitchen_projects_own_select" on public.kitchen_projects
  for select using (auth.uid() = user_id);
create policy "kitchen_projects_own_insert" on public.kitchen_projects
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );
create policy "kitchen_projects_own_update" on public.kitchen_projects
  for update using (auth.uid() = user_id);
create policy "kitchen_projects_own_delete" on public.kitchen_projects
  for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
