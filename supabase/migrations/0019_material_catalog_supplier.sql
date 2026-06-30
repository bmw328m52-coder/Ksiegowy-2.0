-- 0019: dostawca pozycji cennika — do grupowania listy zakupów per klient.
-- supplier NULL = dostawca zostanie wywnioskowany z kategorii/nazwy (helper resolveSupplier),
-- a w ostateczności trafi do grupy "Inne".

alter table public.material_catalog
  add column if not exists supplier text;
