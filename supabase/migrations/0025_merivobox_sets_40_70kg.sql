-- 0025: pełna siatka zestawów Merivobox — każda konfiguracja w 40kg i 70kg (16 pozycji).
-- 70kg = 40kg + różnica prowadnicy 453 vs 450 (+27,3 zł/długość) — zweryfikowane na pozycjach
-- pokazanych wprost przez Merkury (2026-06-03). Zastępuje zestawy bez udźwigu w nazwie (0024).
-- Dno/ścianka tylna NIE w zestawie (Zimex). Kolor nie zmienia ceny. Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, 'kpl', 'Szuflady komplety', 'Mercury', x.gross,
         'Gotowy zestaw Merkury. Dno/ścianka tylna w Zimexie.'
  from (values
    ('Zestaw szuflady Merivobox 450mm niska M 40kg (biały/szary/antracyt)', 165.25::numeric),
    ('Zestaw szuflady Merivobox 500mm niska M 40kg (biały/szary/antracyt)', 167.51::numeric),
    ('Zestaw szuflady Merivobox 450mm niska K 40kg (biały/szary/antracyt)', 207.27::numeric),
    ('Zestaw szuflady Merivobox 500mm niska K 40kg (biały/szary/antracyt)', 209.56::numeric),
    ('Zestaw szuflady Merivobox 450mm wysoka z relingiem E 40kg (biały/szary/antracyt)', 207.91::numeric),
    ('Zestaw szuflady Merivobox 500mm wysoka z relingiem E 40kg (biały/szary/antracyt)', 210.65::numeric),
    ('Zestaw szuflady Merivobox 450mm wysoka z boxcap E 40kg (biały/szary/antracyt)', 232.47::numeric),
    ('Zestaw szuflady Merivobox 500mm wysoka z boxcap E 40kg (biały/szary/antracyt)', 235.52::numeric),
    ('Zestaw szuflady Merivobox 450mm niska M 70kg (biały/szary/antracyt)', 192.53::numeric),
    ('Zestaw szuflady Merivobox 500mm niska M 70kg (biały/szary/antracyt)', 194.80::numeric),
    ('Zestaw szuflady Merivobox 450mm niska K 70kg (biały/szary/antracyt)', 234.55::numeric),
    ('Zestaw szuflady Merivobox 500mm niska K 70kg (biały/szary/antracyt)', 236.85::numeric),
    ('Zestaw szuflady Merivobox 450mm wysoka z relingiem E 70kg (biały/szary/antracyt)', 235.19::numeric),
    ('Zestaw szuflady Merivobox 500mm wysoka z relingiem E 70kg (biały/szary/antracyt)', 237.94::numeric),
    ('Zestaw szuflady Merivobox 450mm wysoka z boxcap E 70kg (biały/szary/antracyt)', 259.75::numeric),
    ('Zestaw szuflady Merivobox 500mm wysoka z boxcap E 70kg (biały/szary/antracyt)', 262.81::numeric)
  ) as x(name, gross)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );

  -- Usuń zestawy bez udźwigu w nazwie (z 0024) oraz stare komplety boki+prowadnica
  delete from public.material_catalog
  where user_id = v_user and name in (
    'Zestaw szuflady Merivobox 450mm niska M (biały/szary/antracyt)',
    'Zestaw szuflady Merivobox 500mm niska M (biały/szary/antracyt)',
    'Zestaw szuflady Merivobox 450mm niska K (biały/szary/antracyt)',
    'Zestaw szuflady Merivobox 500mm niska K (biały/szary/antracyt)',
    'Zestaw szuflady Merivobox 450mm wysoka z relingiem E (biały/szary/antracyt)',
    'Zestaw szuflady Merivobox 500mm wysoka z relingiem E (biały/szary/antracyt)',
    'Zestaw szuflady Merivobox 450mm wysoka z boxcap E (biały/szary/antracyt)',
    'Zestaw szuflady Merivobox 500mm wysoka z boxcap E (biały/szary/antracyt)',
    'KOMPLET Merivobox wys.M 400mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.M 500mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.M 600mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.K 400mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.K 500mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.K 550mm (boki + prowadnica 40kg)'
  );
end $$;
