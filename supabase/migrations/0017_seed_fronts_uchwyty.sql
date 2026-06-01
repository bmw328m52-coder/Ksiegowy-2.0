-- 0017: dosypanie cennika — fronty MDF lakierowane + uchwyt frezowany
-- Ceny brutto z cennika dostawcy (2026-06). Idempotentne (pomija duplikaty po nazwie).

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

  insert into public.material_catalog (user_id, name, unit, category, default_price_gross, notes)
  select v_user, x.name, x.unit, x.category, x.gross, x.notes
  from (values
    ('Front MDF lakier — Biały Połysk',              'm2',  'Fronty lakierowane MDF (JUKA)', 406::numeric, '18 mm; cena brutto/m²'),
    ('Front MDF lakier — Kolor Połysk',              'm2',  'Fronty lakierowane MDF (JUKA)', 443::numeric, '18 mm; cena brutto/m²'),
    ('Front MDF lakier — Kolor Połysk (intensywne)', 'm2',  'Fronty lakierowane MDF (JUKA)', 466::numeric, '18 mm; cena brutto/m²'),
    ('Front MDF lakier — Biały Mat',                 'm2',  'Fronty lakierowane MDF (JUKA)', 365::numeric, '18 mm; cena brutto/m²'),
    ('Front MDF lakier — Kolor Mat',                 'm2',  'Fronty lakierowane MDF (JUKA)', 394::numeric, '18 mm; cena brutto/m²'),
    ('Uchwyt frezowany NK / FS / F45ST',             'szt', 'Uchwyty',                       25::numeric,  'Standardowy, frezowany w froncie')
  ) as x(name, unit, category, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc
    where mc.user_id = v_user and mc.name = x.name
  );
end $$;
