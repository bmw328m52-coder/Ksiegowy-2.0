-- ============================================================
-- Odliczenie VAT per pozycja kosztu (100% / 50% / 0%).
-- Odpowiada na pytanie „ile realnie mam VAT-u do odliczenia".
-- Dashboard liczy VAT naliczony z cost_lines — dlatego pole tu, nie na invoices.
-- ============================================================

alter table public.cost_lines
  add column if not exists vat_deduction smallint not null default 100;

-- Dozwolone wartości: 0, 50, 100 (samochód/paliwo zwykle 50%).
alter table public.cost_lines
  drop constraint if exists cost_lines_vat_deduction_chk;
alter table public.cost_lines
  add constraint cost_lines_vat_deduction_chk
  check (vat_deduction in (0, 50, 100));

-- Auto-podpowiedź dla już istniejących pozycji paliwowych: 50%.
update public.cost_lines
   set vat_deduction = 50
 where category = 'paliwo'
   and vat_deduction = 100;
