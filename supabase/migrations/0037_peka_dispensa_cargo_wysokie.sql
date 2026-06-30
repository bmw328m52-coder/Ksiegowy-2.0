-- 0037: cargo wysokie Peka DISPENSA Libell (4 warianty białe). Ceny zakupowe BRUTTO
-- podane przez Artura 2026-06-11. supplier='Peka', category='Kosze cargo wysokie'.
-- Oznaczenie: zakres wysokości zabudowy / szerokość korpusu (mm) / liczba koszy / kolor.
-- Idempotentne (pomija po nazwie).

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, 'kpl', 'Kosze cargo wysokie', 'Peka', x.gross,
         'Peka (Kesseböhmer DISPENSA Libell). Oznaczenie: zakres wysokości zabudowy / szerokość korpusu (mm) / liczba koszy / kolor. Cena zakupowa BRUTTO podana przez Artura 2026-06-11.'
  from (values
    ('Cargo wysokie DISPENSA Libell 1600-1900 / 300 / 5 koszy, białe', 2025.00::numeric),
    ('Cargo wysokie DISPENSA Libell 1600-1900 / 200 / 5 koszy, białe', 2213.50),
    ('Cargo wysokie DISPENSA Libell 1900-2300 / 200 / 6 koszy, białe', 2483.00),
    ('Cargo wysokie DISPENSA Libell 1900-2300 / 300 / 6 koszy, białe', 2254.00)
  ) as x(name, gross)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );
end $$;
