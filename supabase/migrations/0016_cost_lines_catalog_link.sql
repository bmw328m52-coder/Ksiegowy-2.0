-- ============================================================
-- Wiązanie linii faktur z pozycją katalogu materiałów.
-- Cel: kalkulator pobiera ceny z najnowszej faktury, nie z
-- default_price_gross. Po spięciu linii action po stronie
-- aplikacji przeliczy unit_price = amount_gross / qty i
-- nadpisze material_catalog.default_price_gross.
-- ============================================================

alter table public.cost_lines
  add column if not exists catalog_id uuid references public.material_catalog(id) on delete set null;

alter table public.cost_lines
  add column if not exists qty numeric(12, 3) not null default 1;

create index if not exists cost_lines_catalog_idx
  on public.cost_lines(catalog_id);
