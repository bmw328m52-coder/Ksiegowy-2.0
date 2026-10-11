-- ============================================================
-- Skany pomieszczeń z iPada (LiDAR / Apple RoomPlan).
-- Aplikacja "LUVIANO Skaner" wysyła rzut 2D (ściany, okna, drzwi,
-- sprzęty) w mm jako jsonb — format opisany w src/lib/dao/room_scans.types.ts.
-- ============================================================

create table if not exists public.room_scans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  name        text not null default 'Pomieszczenie',
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists room_scans_job_idx on public.room_scans(job_id, created_at desc);

alter table public.room_scans enable row level security;

drop policy if exists "room_scans_own_select" on public.room_scans;
drop policy if exists "room_scans_own_insert" on public.room_scans;
drop policy if exists "room_scans_own_update" on public.room_scans;
drop policy if exists "room_scans_own_delete" on public.room_scans;

create policy "room_scans_own_select" on public.room_scans
  for select using (auth.uid() = user_id);
create policy "room_scans_own_insert" on public.room_scans
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );
create policy "room_scans_own_update" on public.room_scans
  for update using (auth.uid() = user_id);
create policy "room_scans_own_delete" on public.room_scans
  for delete using (auth.uid() = user_id);
