-- 0031: partia 2026-06-08 — komplety zawiasów (155°/110° onyks + równoległe z 199.8130),
-- prowadnik 199.8130, Servo-Drive UNO (belmeb), kosze cargo dolne (Nomet/Rejs),
-- oraz uzupełnienie cen 3 pozycji LED Design Light (orientacyjne, rynkowe).
-- Ceny brutto. Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  -- (A) Zawiasy: prowadnik równoległy + komplety
  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, x.unit, x.category, 'Mercury', x.gross, x.notes
  from (values
    ('Prowadnik krzyżowy do drzwi równoległych Blum 199.8130', 'szt', 'Zawiasy', 3.60::numeric, 'Dedykowany prowadnik (płytka montażowa) do zawiasów równoległych Blum.'),
    ('KOMPLET zawias Blum 71B7550 BLUMOTION 155° + prowadnik 173H7100', 'kpl', 'Zawiasy komplety', 27.28, 'Zawias 155° Blumotion (25,14) + prowadnik 173H7100 (2,14).'),
    ('KOMPLET zawias Blum 71B7550 BLUMOTION 155° onyks + prowadnik 173H7100', 'kpl', 'Zawiasy komplety', 31.73, 'Zawias 155° Blumotion onyks (29,59) + prowadnik 173H7100 (2,14).'),
    ('KOMPLET zawias Blum 71B3550 BLUMOTION 110° onyks + prowadnik 173H7100', 'kpl', 'Zawiasy komplety', 15.84, 'Zawias 110° Blumotion onyks (13,70) + prowadnik 173H7100 (2,14).'),
    ('KOMPLET zawias równoległy Blum 79T9550 Clip-T 95° + prowadnik 199.8130', 'kpl', 'Zawiasy komplety', 13.48, 'Równoległy 95° (9,88) + 199.8130 (3,60).'),
    ('KOMPLET zawias równoległy Blum 79B9550 BLUMOTION 95° (nikiel) + prowadnik 199.8130', 'kpl', 'Zawiasy komplety', 21.42, 'Równoległy Blumotion nikiel (17,82) + 199.8130 (3,60).'),
    ('KOMPLET zawias równoległy Blum 79B9550 BLUMOTION 95° onyks + prowadnik 199.8130', 'kpl', 'Zawiasy komplety', 22.79, 'Równoległy Blumotion onyks (19,19) + 199.8130 (3,60).'),
    ('KOMPLET zawias równoległy Blum 78T9550.83 Clip-T 83° bez sprężyny + prowadnik 199.8130', 'kpl', 'Zawiasy komplety', 14.68, 'Równoległy 83° bez sprężyny (11,08) + 199.8130 (3,60).'),
    ('KOMPLET zawias równoległy nakładany Blum 79T9950.37 Clip-T 95° + prowadnik 199.8130', 'kpl', 'Zawiasy komplety', 24.09, 'Równoległy nakładany 95° (20,49) + 199.8130 (3,60).'),
    ('Zestaw Servo-Drive UNO do stojących sortowników na śmieci (NOWA WERSJA) Blum Z10UB00EE', 'kpl', 'Sortowniki', 570.00, 'Następca Z10NA30EE. Cena z belmeb.pl (570) — belmeb blokuje scraping, do weryfikacji.'),
    ('Kosz cargo dolne Nomet mini 15cm 3-poziomowy, chrom', 'kpl', 'Kosze cargo dolne', 99.00, 'Cena z Allegro (rynkowa) — podmień na zakupową.'),
    ('Kosz cargo dolne Rejs 20cm 2-poziomowy, cichy domyk', 'kpl', 'Kosze cargo dolne', 148.49, 'Cena z Allegro (rynkowa) — podmień na zakupową.'),
    ('Kosz cargo dolne Rejs 25cm 2-poziomowy antracyt (Multi Variant 250), cichy domyk', 'kpl', 'Kosze cargo dolne', 170.00, 'Cena z Allegro (rynkowa) — podmień na zakupową.'),
    ('Kosz cargo dolne Rejs 30cm 2-poziomowy, cichy domyk', 'kpl', 'Kosze cargo dolne', 144.35, 'Cena z Allegro (rynkowa) — podmień na zakupową.'),
    ('Kosz cargo dolne Rejs 60cm 2-poziomowy, cichy domyk', 'kpl', 'Kosze cargo dolne', 244.00, 'Cena z Allegro (rynkowa) — podmień na zakupową.')
  ) as x(name, unit, category, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );

  -- Servo/kosze: dostawcy poprawni (insert wyżej dał 'Mercury' przez select — popraw)
  update public.material_catalog set supplier = 'Belmeb'
   where user_id = v_user and name = 'Zestaw Servo-Drive UNO do stojących sortowników na śmieci (NOWA WERSJA) Blum Z10UB00EE';
  update public.material_catalog set supplier = 'Nomet'
   where user_id = v_user and name = 'Kosz cargo dolne Nomet mini 15cm 3-poziomowy, chrom';
  update public.material_catalog set supplier = 'Rejs'
   where user_id = v_user and name like 'Kosz cargo dolne Rejs %';

  -- (B) Uzupełnienie cen LED (orientacyjne — Design Light blokuje cennik online)
  update public.material_catalog set default_price_gross = 109.00
   where user_id = v_user and name = 'Zasilacz LED 24V DC 100W meblowy Design Light' and default_price_gross is null;
  update public.material_catalog set default_price_gross = 39.00
   where user_id = v_user and name = 'Profil aluminiowy nawierzchniowy LED Design Light 2m + klosz' and default_price_gross is null;
  update public.material_catalog set default_price_gross = 119.00
   where user_id = v_user and name = 'Taśma LED COB 24V CRI90+ 4000K ~13W/m Design Light (rolka 5m)' and default_price_gross is null;
end $$;
