-- 0022: (1) uzupełnia ceny zawiasów-placeholderów (były NULL),
--       (2) dodaje zawieszki Blum do szafek + adaptery TIP-ON do drzwi + zawias 170°.
-- Ceny brutto PLN, sklep.merkuryam.pl 2026-06-03. Idempotentne.

do $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  -- (1) Uzupełnienie cen istniejących zawiasów (tylko gdy cena pusta) ----------
  update public.material_catalog set default_price_gross = 6.17,  notes = coalesce(notes,'Blum 71T3550 Clip-T 110° bez amortyzacji')
    where user_id = v_user and name = 'Zawias Blum Clip Top 110°' and default_price_gross is null;
  update public.material_catalog set default_price_gross = 12.29, notes = coalesce(notes,'Blum 71B3550 Blumotion Clip-T 110° z amortyzacją')
    where user_id = v_user and name = 'Zawias Blum Clip Top BLUMOTION 110°' and default_price_gross is null;
  update public.material_catalog set default_price_gross = 14.27, notes = coalesce(notes,'Blum 71T6550 Clip-T 170° ze sprężyną')
    where user_id = v_user and name = 'Zawias Blum Clip Top 170° kąt szeroki' and default_price_gross is null;
  update public.material_catalog set default_price_gross = 9.88,  notes = coalesce(notes,'Blum 79T9550 Clip-T 95° równoległy wpuszczany')
    where user_id = v_user and name = 'Zawias narożnikowy Blum 95°' and default_price_gross is null;

  -- (2) Nowe pozycje (idempotentne po nazwie) ----------
  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, x.unit, x.category, 'Mercury', x.gross, x.notes
  from (values
    ('Zawieszka do szafek Blum 48N0510.02 prawa, biała (130kg/para)', 'szt', 'Zawieszki', 5.18::numeric, NULL),
    ('Zawieszka do szafek Blum 48N0510.03 lewa, biała (130kg/para)',  'szt', 'Zawieszki', 5.18::numeric, NULL),
    ('Adapter prosty wpuszczany do TIP-ON Blum 956A1201 długi (biały/szary)', 'szt', 'Tip-on', 3.51::numeric,
     'Montaż wpuszczany w bok korpusu. Łączy się z odbojnikiem TIP-ON 956A1004/1006 — otwieranie frontów bez uchwytu.'),
    ('Adapter krzyżakowy do TIP-ON Blum 956A1501 długi, szary', 'szt', 'Tip-on', 2.51::numeric,
     'Mocowany na prowadniku zawiasu — TIP-ON do drzwiczek z zawiasami. Łączy się z odbojnikiem TIP-ON.'),
    ('Zawias nakładany Blum 71T6550 Clip-T 170° ze sprężyną (kąt szeroki)', 'szt', 'Zawiasy', 14.27::numeric, NULL)
  ) as x(name, unit, category, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );
end $$;
