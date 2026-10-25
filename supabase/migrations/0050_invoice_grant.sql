-- ============================================================
-- Zakupy sfinansowane dotacją (PUP). Wydatek z dotacji zwolnionej z PIT
-- nie jest kosztem uzyskania przychodu — pulpit pomija go w kosztach/PIT,
-- a VAT z takich faktur pokazuje osobno (zwykle do zwrotu do PUP).
-- ============================================================

alter table public.invoices
  add column if not exists funded_by_grant boolean not null default false;
