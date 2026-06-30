-- 0038: cargo podblatowe Peka (SLIM ARENA Classic / SNELLO / Junior ARENA Classic).
-- Ceny zakupowe BRUTTO podane przez Artura 2026-06-11. supplier='Peka', category='Kosze cargo podblatowe'.
-- Idempotentne (pomija po nazwie).

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, 'kpl', 'Kosze cargo podblatowe', 'Peka', x.gross,
         'Peka. Cena zakupowa BRUTTO podana przez Artura 2026-06-11.'
  from (values
    ('Cargo podblatowe SLIM ARENA Classic 610 / 300 / 2 kosze, białe', 904.51::numeric),
    ('Cargo podblatowe SNELLO 300, białe', 777.00),
    ('Cargo podblatowe Junior ARENA Classic Silver / 300, szare', 811.00)
  ) as x(name, gross)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );
end $$;
