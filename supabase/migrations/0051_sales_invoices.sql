-- ============================================================
-- Faktury sprzedażowe pobierane z KSeF (Artur = wystawca, Subject1).
-- Podstawa PIT/VAT należnego = te faktury (wg daty wystawienia).
-- job_id = przypięte zlecenie (rentowność, „zlecenie z fakturą").
-- ============================================================

create table if not exists public.sales_invoices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  ksef_number     text not null,
  invoice_number  text,
  invoice_type    text,
  issue_date      date not null,
  buyer_name      text,
  buyer_nip       text,
  amount_net      numeric(12, 2) not null default 0,
  amount_vat      numeric(12, 2) not null default 0,
  amount_gross    numeric(12, 2) not null default 0,
  vat_rate        numeric(5, 4),
  payment_due     date,
  paid            boolean not null default false,
  paid_date       date,
  lines           jsonb,
  file_path       text,
  job_id          uuid references public.jobs(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists sales_invoices_user_ksef_uq
  on public.sales_invoices(user_id, ksef_number);
create index if not exists sales_invoices_job_idx on public.sales_invoices(job_id);

alter table public.sales_invoices enable row level security;
drop policy if exists "sales_invoices_own" on public.sales_invoices;
create policy "sales_invoices_own" on public.sales_invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.ksef_connections
  add column if not exists sales_synced_until timestamptz;
