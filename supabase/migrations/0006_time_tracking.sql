-- ============================================================
-- Time tracking — wpisy czasu pracy per zlecenie / faza
-- ============================================================

create type public.work_phase as enum (
  'pomiar',
  'projekt',
  'produkcja',
  'montaz',
  'inne'
);

create table public.time_entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  job_id            uuid not null references public.jobs(id) on delete cascade,
  phase             public.work_phase not null,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_minutes  integer,
  source            text not null default 'timer' check (source in ('timer', 'manual')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint time_entries_duration_nonneg check (duration_minutes is null or duration_minutes >= 0),
  constraint time_entries_ended_after_started check (ended_at is null or ended_at >= started_at),
  constraint time_entries_manual_has_duration check (
    (source = 'manual' and ended_at is not null and duration_minutes is not null)
    or source = 'timer'
  )
);

create index time_entries_user_idx on public.time_entries(user_id);
create index time_entries_job_idx  on public.time_entries(job_id);
create index time_entries_active_idx on public.time_entries(user_id) where ended_at is null;

-- Tylko jeden aktywny licznik na użytkownika
create unique index time_entries_one_active_per_user
  on public.time_entries(user_id)
  where ended_at is null;

create trigger time_entries_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

alter table public.time_entries enable row level security;

create policy "time_entries_own_select" on public.time_entries for select using (auth.uid() = user_id);
create policy "time_entries_own_insert" on public.time_entries for insert with check (auth.uid() = user_id);
create policy "time_entries_own_update" on public.time_entries for update using (auth.uid() = user_id);
create policy "time_entries_own_delete" on public.time_entries for delete using (auth.uid() = user_id);
