-- 0020: dosypanie cennika — oświetlenie LED Design Light.
-- Sklep designlight.pl blokuje pobranie cen (HTTP 403), więc ceny zostają NULL
-- i wymagają ręcznego uzupełnienia z designlight.pl / oferty hurtowej.
-- Rekomendacja sprzętu (kuchnia pod szafki): taśma COB 24V CRI90+, 4000K, ~12-13W/m, IP20.
-- supplier = 'Design Light' (dodany do słownika dostawców w suppliers.ts). Idempotentne (pomija po nazwie).

do $$
declare
  v_user uuid;
begin
  select id into v_user
  from auth.users
  where email = 'bmw328m52@gmail.com'
  limit 1;

  if v_user is null then
    raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com';
  end if;

  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, x.unit, x.category, x.supplier, x.gross, x.notes
  from (values
    ('Taśma LED COB 24V CRI90+ 4000K ~13W/m Design Light (rolka 5m)', 'rolka', 'Oświetlenie LED', 'Design Light', NULL::numeric,
     'Design Light. CENA DO UZUPEŁNIENIA (designlight.pl blokuje scraping). Rekomendacja pod szafki: COB 24V, CRI90+, neutralna 4000K, IP20.'),
    ('Profil aluminiowy nawierzchniowy LED Design Light 2m + klosz', 'szt', 'Oświetlenie LED', 'Design Light', NULL::numeric,
     'Design Light. CENA DO UZUPEŁNIENIA. Płaski profil nawierzchniowy 2m z kloszem mlecznym.'),
    ('Zasilacz LED 24V DC 100W meblowy Design Light', 'szt', 'Oświetlenie LED', 'Design Light', NULL::numeric,
     'Design Light. CENA DO UZUPEŁNIENIA. Dobór mocy: suma W taśmy + ~20% zapasu.'),
    ('Złączka do taśm LED COB 8mm Design Light', 'szt', 'Oświetlenie LED', 'Design Light', NULL::numeric,
     'Design Light. CENA DO UZUPEŁNIENIA. Łączenie odcinków taśmy bez lutowania.')
  ) as x(name, unit, category, supplier, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc
    where mc.user_id = v_user and mc.name = x.name
  );
end $$;
