-- ============================================================
-- Stawki ZUS (3 presety dla kalkulatora wyceny)
-- + Lista kategorii materiałów (BOM kalkulator)
-- ============================================================

alter table public.user_settings
  add column if not exists zus_ulga numeric(10, 2) default 0,
  add column if not exists zus_maly numeric(10, 2) default 0,
  add column if not exists zus_pelny numeric(10, 2) default 0,
  add column if not exists material_categories text[] default array[
    'fronty',
    'blaty',
    'szuflady',
    'zawiasy',
    'siłowniki',
    'ledy',
    'zawieszki',
    'nóżki',
    'szyna zawieszkowa',
    'projekt',
    'silikony',
    'klej',
    'złącza',
    'kosze cargo',
    'systemy',
    'wkład do szuflady'
  ]::text[];

-- Backfill domyślnymi stawkami ZUS 2026 dla istniejących wierszy (jeśli zera)
update public.user_settings
set zus_ulga  = 397.16,
    zus_maly  = 891.34,
    zus_pelny = 1900.00
where zus_ulga = 0 and zus_maly = 0 and zus_pelny = 0;
