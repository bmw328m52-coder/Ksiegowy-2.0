-- ============================================================
-- Szablony wycen (kalkulator)
-- ============================================================
create table public.quote_templates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  amount_gross    numeric(12, 2) not null default 0,
  vat_rate        numeric(5, 4) not null default 0.23,
  costs_gross     numeric(12, 2) not null default 0,
  costs_vat_rate  numeric(5, 4) not null default 0.23,
  tax_form        public.tax_form not null default 'skala',
  is_vat_payer    boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index quote_templates_user_idx on public.quote_templates(user_id, name);

create trigger quote_templates_updated_at
  before update on public.quote_templates
  for each row execute function public.set_updated_at();

alter table public.quote_templates enable row level security;

create policy "quote_templates_own_select" on public.quote_templates for select using (auth.uid() = user_id);
create policy "quote_templates_own_insert" on public.quote_templates for insert with check (auth.uid() = user_id);
create policy "quote_templates_own_update" on public.quote_templates for update using (auth.uid() = user_id);
create policy "quote_templates_own_delete" on public.quote_templates for delete using (auth.uid() = user_id);
