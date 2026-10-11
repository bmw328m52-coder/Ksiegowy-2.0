-- ============================================================
-- ZUS: data rozpoczęcia działalności → automatyczne wyliczanie fazy
-- (Ulga na start → Preferencyjny → Pełny) i kwoty do zapłaty.
-- Zdrowotna liczona z dochodu w kodzie; tu tylko minimum edytowalne.
--
-- Uwaga: w niektórych bazach migracja 0005 nie została wykonana,
-- więc tworzymy też brakujące kolumny ZUS/materiałów (if not exists).
-- ============================================================

alter table public.user_settings
  add column if not exists zus_start_date       date,
  add column if not exists zus_ulga             numeric(10,2) default 397.16,
  add column if not exists zus_maly             numeric(10,2) default 891.34,
  add column if not exists zus_pelny            numeric(10,2) default 1900.00,
  add column if not exists health_insurance_min numeric(10,2) default 432.54,
  add column if not exists material_categories  text[];

-- Minimalna składka zdrowotna 2026 (9% z 4806 zł = 432,54 zł).
update public.user_settings
set health_insurance_min = 432.54
where health_insurance_min is null or health_insurance_min = 0;

-- Presety ZUS kalkulatora — uzupełnij, jeśli puste/zerowe.
update public.user_settings set zus_ulga  = 397.16  where zus_ulga  is null or zus_ulga  = 0;
update public.user_settings set zus_maly  = 891.34  where zus_maly  is null or zus_maly  = 0;
update public.user_settings set zus_pelny = 1900.00 where zus_pelny is null or zus_pelny = 0;
