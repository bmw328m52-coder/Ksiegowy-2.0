-- ============================================================
-- Domyślna stawka godzinowa "na rękę" dla kalkulatora usług
-- ============================================================

alter table public.user_settings
  add column if not exists default_hourly_rate numeric(10, 2) default 50;

update public.user_settings
set default_hourly_rate = 50
where default_hourly_rate is null;
