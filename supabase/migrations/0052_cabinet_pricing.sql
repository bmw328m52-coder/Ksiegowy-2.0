-- ============================================================
-- Cennik szafek (stawki + marża) i przybliżona cena ze skanu.
-- cabinet_pricing.rates — typ Rates z src/lib/cabinetPricing.ts
-- room_scans.estimate   — wybory przy skanie (rodzaje szafek, dodatki)
-- ============================================================

create table if not exists public.cabinet_pricing (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  rates       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.cabinet_pricing enable row level security;

drop policy if exists "cabinet_pricing_own_select" on public.cabinet_pricing;
drop policy if exists "cabinet_pricing_own_insert" on public.cabinet_pricing;
drop policy if exists "cabinet_pricing_own_update" on public.cabinet_pricing;
drop policy if exists "cabinet_pricing_own_delete" on public.cabinet_pricing;

create policy "cabinet_pricing_own_select" on public.cabinet_pricing
  for select using (auth.uid() = user_id);
create policy "cabinet_pricing_own_insert" on public.cabinet_pricing
  for insert with check (auth.uid() = user_id);
create policy "cabinet_pricing_own_update" on public.cabinet_pricing
  for update using (auth.uid() = user_id);
create policy "cabinet_pricing_own_delete" on public.cabinet_pricing
  for delete using (auth.uid() = user_id);

alter table public.room_scans add column if not exists estimate jsonb;

notify pgrst, 'reload schema';
