-- 0026: auto-wycena z pomiaru.
-- (1) quote_autoprice_bindings: slot wyceny (lakier, blat, LED, typy zawiasów, siłowniki) → pozycja cennika.
-- (2) job_materials.auto_source: znacznik linii wygenerowanej automatycznie (reconcile), by odróżnić ją
--     od ręcznych (auto_source = NULL). Reconcile zarządza tylko liniami z auto_source.

create table if not exists public.quote_autoprice_bindings (
  user_id    uuid not null references auth.users(id) on delete cascade,
  slot       text not null,
  catalog_id uuid not null references public.material_catalog(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

drop trigger if exists quote_autoprice_bindings_updated_at on public.quote_autoprice_bindings;
create trigger quote_autoprice_bindings_updated_at
  before update on public.quote_autoprice_bindings
  for each row execute function public.set_updated_at();

alter table public.quote_autoprice_bindings enable row level security;

drop policy if exists "qab_own_select" on public.quote_autoprice_bindings;
drop policy if exists "qab_own_insert" on public.quote_autoprice_bindings;
drop policy if exists "qab_own_update" on public.quote_autoprice_bindings;
drop policy if exists "qab_own_delete" on public.quote_autoprice_bindings;

create policy "qab_own_select" on public.quote_autoprice_bindings
  for select using (auth.uid() = user_id);
create policy "qab_own_insert" on public.quote_autoprice_bindings
  for insert with check (auth.uid() = user_id);
create policy "qab_own_update" on public.quote_autoprice_bindings
  for update using (auth.uid() = user_id);
create policy "qab_own_delete" on public.quote_autoprice_bindings
  for delete using (auth.uid() = user_id);

alter table public.job_materials
  add column if not exists auto_source text;

create index if not exists job_materials_auto_idx
  on public.job_materials(job_id, auto_source);
