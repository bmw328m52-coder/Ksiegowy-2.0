-- ============================================================
-- Pliki projektu przy zleceniu (zrzuty / PDF z PRO100 zamienione na obrazy)
-- z poprawkami nanoszonymi na tablecie. Obraz zostaje nietknięty —
-- poprawki (pisak, linie, teksty) leżą osobno w `marks` (jsonb),
-- format w src/lib/dao/job_files.types.ts.
-- Bucket prywatny; ścieżka {user_id}/{uuid}.{jpg|png|webp}.
-- ============================================================

create table if not exists public.job_files (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  name        text not null default 'Projekt',
  file_path   text not null,
  width       integer not null,
  height      integer not null,
  marks       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists job_files_job_idx on public.job_files(job_id, created_at);

alter table public.job_files enable row level security;

drop policy if exists "job_files_own_select" on public.job_files;
drop policy if exists "job_files_own_insert" on public.job_files;
drop policy if exists "job_files_own_update" on public.job_files;
drop policy if exists "job_files_own_delete" on public.job_files;

create policy "job_files_own_select" on public.job_files
  for select using (auth.uid() = user_id);
create policy "job_files_own_insert" on public.job_files
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );
create policy "job_files_own_update" on public.job_files
  for update using (auth.uid() = user_id);
create policy "job_files_own_delete" on public.job_files
  for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-files', 'job-files', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "job_files_obj_own_select" on storage.objects;
drop policy if exists "job_files_obj_own_insert" on storage.objects;
drop policy if exists "job_files_obj_own_update" on storage.objects;
drop policy if exists "job_files_obj_own_delete" on storage.objects;

create policy "job_files_obj_own_select"
  on storage.objects for select
  using (bucket_id = 'job-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "job_files_obj_own_insert"
  on storage.objects for insert
  with check (bucket_id = 'job-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "job_files_obj_own_update"
  on storage.objects for update
  using (bucket_id = 'job-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "job_files_obj_own_delete"
  on storage.objects for delete
  using (bucket_id = 'job-files' and (storage.foldername(name))[1] = auth.uid()::text);
