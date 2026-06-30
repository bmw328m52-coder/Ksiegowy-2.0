-- 0028: porządek z zawiasami Blum + nowe pozycje.
-- (1) Usuwa legacy duplikaty bez numerów katalogowych (te same ceny co precyzyjne wpisy):
--     „Clip Top 110°"=71T3550, „Clip Top BLUMOTION 110°"=71B3550, „Clip Top 170° kąt szeroki"=71T6550.
--     Sprawdzone: 0 powiązań (job_materials, quote_autoprice_bindings, calculator_bindings, cost_lines).
-- (2) Dodaje: 71B7550 155° Blumotion (nikiel+onyks), 71B3550 110° onyks, 79B9550 równoległy Blumotion onyks,
--     oraz KOMPLET 170° (71T6550 + klipsowy Blumotion 973A6000). Ceny brutto sklep.merkuryam.pl 2026-06-08.
-- Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  -- (1) Usuń legacy duplikaty
  delete from public.material_catalog
  where user_id = v_user and name in (
    'Zawias Blum Clip Top 110°',
    'Zawias Blum Clip Top BLUMOTION 110°',
    'Zawias Blum Clip Top 170° kąt szeroki'
  );

  -- (2) Dodaj nowe zawiasy + komplet
  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, x.unit, x.category, 'Mercury', x.gross, x.notes
  from (values
    ('Zawias Blum 71B7550 BLUMOTION Clip-T 155° nakładany (zerowy uskok)', 'szt', 'Zawiasy', 25.14::numeric,
     'Wbudowany Blumotion (cichy domyk). Najszerszy kąt z fabrycznym Blumotion (Blum nie ma 170° z wbud. Blumotion).'),
    ('Zawias Blum 71B7550 BLUMOTION Clip-T 155° nakładany, onyks', 'szt', 'Zawiasy', 29.59::numeric,
     'Wersja onyks (czarna). Wbudowany Blumotion 155°. Nikiel: 25,14.'),
    ('Zawias Blum 71B3550 BLUMOTION Clip-T 110° nakładany, onyks', 'szt', 'Zawiasy', 13.70::numeric,
     'Wersja onyks głównego zawiasu 110° z Blumotion. Nikiel: 12,29.'),
    ('Zawias równoległy wpuszczany Blum 79B9550 BLUMOTION Clip-T 95°, onyks', 'szt', 'Zawiasy', 19.19::numeric,
     'Równoległy z wbudowanym Blumotion — odpowiednik 79T9550, ale z cichym domykiem. Onyks.'),
    ('KOMPLET zawias Blum 71T6550 Clip-T 170° + klipsowy Blumotion 973A6000 (cichy domyk)', 'kpl', 'Zawiasy komplety', 24.77::numeric,
     'Zawias 170° ze sprężyną (14,27) + amortyzator klipsowy Blumotion 973A6000 (10,50). Pełne 170° z cichym domykiem.')
  ) as x(name, unit, category, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );
end $$;
