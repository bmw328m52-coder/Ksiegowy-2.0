-- ============================================================
-- Zlecenia: zaliczka / zadatek
-- ============================================================

alter table public.jobs
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists deposit_date   date;
