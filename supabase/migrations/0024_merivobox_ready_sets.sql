-- 0024: Merivobox jako gotowe ZESTAWY Merkury (boki+prowadnica+uchwyt+mocowania+zaślepki).
-- Zastępuje wcześniejsze przybliżone komplety boki+prowadnica (0017/dosypka).
-- Ceny brutto = gotowy zestaw Merkury (rabat bundle), sklep.merkuryam.pl 2026-06-03. Kolor nie zmienia ceny.
-- Dno i ścianka tylna NIE w zestawie (Artur tnie w Zimexie). Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  -- (1) Wstaw gotowe zestawy ----------
  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, 'kpl', 'Szuflady komplety', 'Mercury', x.gross, x.notes
  from (values
    ('Zestaw szuflady Merivobox 450mm niska M (biały/szary/antracyt)', 165.25::numeric, '40kg. Boki M + prowadnica + uchwyt ścianki tylnej + mocowania frontu + zaślepki. Dno/ścianka tylna w Zimexie.'),
    ('Zestaw szuflady Merivobox 500mm niska M (biały/szary/antracyt)', 167.51::numeric, '40kg. Boki M + prowadnica + uchwyt ścianki tylnej + mocowania frontu + zaślepki. Dno/ścianka tylna w Zimexie.'),
    ('Zestaw szuflady Merivobox 450mm niska K (biały/szary/antracyt)', 234.55::numeric, '70kg. Pełny zestaw wys. K. Dno/ścianka tylna w Zimexie.'),
    ('Zestaw szuflady Merivobox 500mm niska K (biały/szary/antracyt)', 209.56::numeric, '40kg. Pełny zestaw wys. K. Dno/ścianka tylna w Zimexie.'),
    ('Zestaw szuflady Merivobox 450mm wysoka z relingiem E (biały/szary/antracyt)', 235.19::numeric, '70kg. Pełny zestaw E z relingiem podłużnym. Dno/ścianka tylna w Zimexie.'),
    ('Zestaw szuflady Merivobox 500mm wysoka z relingiem E (biały/szary/antracyt)', 210.65::numeric, '40kg. Pełny zestaw E z relingiem podłużnym. Dno/ścianka tylna w Zimexie.'),
    ('Zestaw szuflady Merivobox 450mm wysoka z boxcap E (biały/szary/antracyt)', 232.47::numeric, '40kg. Pełny zestaw E z boxcap (pełny front). Dno/ścianka tylna w Zimexie.'),
    ('Zestaw szuflady Merivobox 500mm wysoka z boxcap E (biały/szary/antracyt)', 235.52::numeric, '40kg. Pełny zestaw E z boxcap (pełny front). Dno/ścianka tylna w Zimexie.')
  ) as x(name, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );

  -- (2) Usuń stare przybliżone komplety boki+prowadnica (zastąpione zestawami) ----------
  delete from public.material_catalog
  where user_id = v_user and name in (
    'KOMPLET Merivobox wys.M 400mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.M 500mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.M 600mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.K 400mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.K 500mm (boki + prowadnica 40kg)',
    'KOMPLET Merivobox wys.K 550mm (boki + prowadnica 40kg)'
  );
end $$;
