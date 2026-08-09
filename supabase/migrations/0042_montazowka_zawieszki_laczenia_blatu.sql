-- 0042: nowe kategorie cennika do pełnej wyceny kuchni „z kartki":
--   Łączenia blatu, Zawieszki, Kołki, Silikony, Wkręty (montażówka).
-- Ceny brutto, ORIENTACYJNE (rynkowe) — podmień na zakupowe.
-- Supplier = NULL celowo: te pozycje NIE są zarządzane sync-em Mercury,
-- więc pełna synchronizacja cennika Mercury ich nie usunie.
-- Idempotentne (insert tylko gdy nazwa jeszcze nie istnieje u użytkownika).

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, x.unit, x.category, null, x.gross, x.notes
  from (values
    -- Łączenia blatu
    ('Listwa łączeniowa prosta do blatu 38 mm, aluminium', 'szt', 'Łączenia blatu', 18.00::numeric, 'Orientacyjna — podmień na zakupową.'),
    ('Listwa końcowa do blatu 38 mm (para L+P), aluminium', 'kpl', 'Łączenia blatu', 22.00, 'Orientacyjna — podmień na zakupową.'),
    ('Złączka blatu — ściąg mimośrodowy (komplet)', 'kpl', 'Łączenia blatu', 14.00, 'Orientacyjna — podmień na zakupową.'),

    -- Zawieszki
    ('Zawieszka meblowa górna regulowana (komplet L+P)', 'kpl', 'Zawieszki', 6.00, 'Orientacyjna — podmień na zakupową.'),
    ('Listwa montażowa do zawieszek szafek górnych, 2 m', 'szt', 'Zawieszki', 12.00, 'Orientacyjna — podmień na zakupową.'),

    -- Kołki
    ('Kołki meblowe bukowe 8×30 mm (100 szt)', 'opak', 'Kołki', 15.00, 'Orientacyjna — podmień na zakupową.'),
    ('Kołki meblowe bukowe 8×40 mm (100 szt)', 'opak', 'Kołki', 18.00, 'Orientacyjna — podmień na zakupową.'),

    -- Silikony
    ('Silikon sanitarny bezbarwny 280 ml', 'szt', 'Silikony', 22.00, 'Orientacyjna — podmień na zakupową.'),
    ('Silikon neutralny biały 280 ml', 'szt', 'Silikony', 20.00, 'Orientacyjna — podmień na zakupową.'),

    -- Wkręty
    ('Wkręty do płyty 4×30 mm (200 szt)', 'opak', 'Wkręty', 18.00, 'Orientacyjna — podmień na zakupową.'),
    ('Wkręty 3,5×16 mm do zawiasów/prowadnic (200 szt)', 'opak', 'Wkręty', 16.00, 'Orientacyjna — podmień na zakupową.'),
    ('Konfirmaty 6,3×50 mm (100 szt)', 'opak', 'Wkręty', 25.00, 'Orientacyjna — podmień na zakupową.')
  ) as x(name, unit, category, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );
end $$;
