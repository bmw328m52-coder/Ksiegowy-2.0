-- ============================================================
-- Wiązania kalkulatora modułowego — slot → pozycja katalogu.
-- Slot to stała pozycja w BOM modułu (HDF plecy, okleina,
-- zawias, prowadnica, noga). Użytkownik wybiera dokładnie jedną
-- pozycję katalogu per slot; brak wpisu = używamy hardcoded
-- wartości z catalog.ts (fallback).
-- ============================================================

create table if not exists public.calculator_bindings (
  user_id     uuid not null references auth.users(id) on delete cascade,
  slot        text not null,
  catalog_id  uuid not null references public.material_catalog(id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (user_id, slot)
);

create index if not exists calculator_bindings_catalog_idx
  on public.calculator_bindings(catalog_id);

drop trigger if exists calculator_bindings_updated_at on public.calculator_bindings;
create trigger calculator_bindings_updated_at
  before update on public.calculator_bindings
  for each row execute function public.set_updated_at();

alter table public.calculator_bindings enable row level security;

drop policy if exists "calculator_bindings_own_select" on public.calculator_bindings;
drop policy if exists "calculator_bindings_own_insert" on public.calculator_bindings;
drop policy if exists "calculator_bindings_own_update" on public.calculator_bindings;
drop policy if exists "calculator_bindings_own_delete" on public.calculator_bindings;

create policy "calculator_bindings_own_select" on public.calculator_bindings
  for select using (auth.uid() = user_id);
create policy "calculator_bindings_own_insert" on public.calculator_bindings
  for insert with check (auth.uid() = user_id);
create policy "calculator_bindings_own_update" on public.calculator_bindings
  for update using (auth.uid() = user_id);
create policy "calculator_bindings_own_delete" on public.calculator_bindings
  for delete using (auth.uid() = user_id);
