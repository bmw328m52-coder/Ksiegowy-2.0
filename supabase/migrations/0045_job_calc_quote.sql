-- ============================================================
-- Migawka wyceny z kalkulatora zapisana na zleceniu.
-- Pozwala pokazać na karcie zlecenia DOKŁADNIE to, co policzył kalkulator
-- (kwota / koszty / ZUS / urlop / zysk), bez ponownego liczenia z materiałów.
-- Jedno pole jsonb — elastyczne, bez zmiany schematu przy korektach składników.
-- ============================================================

alter table public.jobs
  add column if not exists calc_quote jsonb;

comment on column public.jobs.calc_quote is
  'Migawka wyceny z kalkulatora: {amountGross, vatRate, withInvoice, costsGross, zus, reserve, hours, profit, savedAt}. NULL = brak przeniesionej wyceny.';
