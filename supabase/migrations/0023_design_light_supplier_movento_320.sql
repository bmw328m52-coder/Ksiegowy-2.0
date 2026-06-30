-- 0023: (1) przenosi pozycje oświetlenia LED na dostawcę 'Design Light' (był 'Inne'),
--       (2) dodaje prowadnicę Movento 320mm (na zamówienie — cena NULL do uzupełnienia),
--       (3) domyka dosypkę z poprz. tury (odbojnik czarny carbon, Movento 300/500, sprzęgło).
-- Idempotentne. Ceny brutto PLN, sklep.merkuryam.pl 2026-06-03.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  -- (1) Design Light jako dostawca ----------
  update public.material_catalog
    set supplier = 'Design Light'
    where user_id = v_user and category = 'Oświetlenie LED';

  -- (2)+(3) Nowe pozycje (idempotentne po nazwie) ----------
  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, x.unit, x.category, 'Mercury', x.gross, x.notes
  from (values
    ('Prowadnica Movento z Blumotion Blum 760H3200S 320mm 40kg (komplet, do skrzynkowej)', 'kpl', 'Prowadnice szuflad', NULL::numeric,
     'NA ZAMÓWIENIE — Mercury nie ma online. CENA DO UZUPEŁNIENIA. Pełny wysuw, drewniane boki, wymaga sprzęgła T51.7601 (L+P).'),
    ('Odbojnik TIP-ON Blum 956A1004 długi z magnesem, czarny carbon', 'szt', 'Tip-on', 19.77::numeric, NULL),
    ('Prowadnica Movento z Blumotion Blum 760H3000S 300mm 40kg (komplet, do skrzynkowej)', 'kpl', 'Prowadnice szuflad', 113.65::numeric,
     'Pełny wysuw, drewniane boki. Wymaga sprzęgła T51.7601 (L+P).'),
    ('Prowadnica Movento z Blumotion Blum 760H5000SU 500mm 40kg (komplet, do skrzynkowej)', 'kpl', 'Prowadnice szuflad', 149.92::numeric,
     'Pełny wysuw, drewniane boki. Wymaga sprzęgła T51.7601 (L+P).'),
    ('Sprzęgło Movento z regulacją boczną Blum T51.7601 (szt — 2 na szufladę)', 'szt', 'Prowadnice szuflad', 6.43::numeric,
     'Lewe/prawe po 6,43 zł. Do prowadnic Movento — 2 szt na jedną szufladę skrzynkową.')
  ) as x(name, unit, category, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );
end $$;
