-- 0033: oświetlenie LED Belmeb (taśmy COB/Neon Flex, zasilacze, wyłączniki, profile LUMINES + klosze).
-- Ceny podane przez Artura 2026-06-10; klosze LUMINES doczytane z belmeb.pl (JSON-LD/og:price).
-- supplier = 'Belmeb'. category = 'Oświetlenie LED'. Idempotentne (pomija po nazwie).
-- Uwaga: napięcie systemu LED u Artura = 24V; barwa pod szafki 4000K, do witryn 3000K.
-- Taśmy gołe (rolka 5m) — długość 5m przy COB BICOLOR i Neon Flex IP65 do potwierdzenia.

do $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then
    raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com';
  end if;

  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, x.unit, 'Oświetlenie LED', 'Belmeb', x.gross, x.notes
  from (values
    ('Taśma COB BICOLOR 608 LED/m IP65 14,8W/m 24V DC (rolka 5m)', 'rolka 5m', 120.00::numeric,
     'Belmeb. 24V, bicolor (regulowana barwa), IP65, 14,8W/m, 608 LED/m. Cena rolka 5m — DŁUGOŚĆ DO POTWIERDZENIA.'),
    ('Taśma COB 480 LED/m IP20 12,8W/m 24V DC (rolka 5m)', 'rolka 5m', 99.00,
     'Belmeb. 24V IP20 12,8W/m 480 LED/m. Rolka 5m (25m=475 zł → ~19 zł/m). Pod szafki wybierz 4000K.'),
    ('Taśma COB 480 LED/m IP20 12,8W/m 24V DC (rolka 25m)', 'rolka 25m', 475.00,
     'Belmeb. 24V IP20 12,8W/m 480 LED/m. Rolka 25m (~19 zł/m).'),
    ('Taśma LED Neon Flex Slim 4x8mm IP67 6,2W/m 24V DC (rolka 5m)', 'rolka 5m', 75.80,
     'Belmeb. 24V IP67 6,2W/m, Neon Flex Slim 4x8mm. Rolka 5m (25m=379 zł → ~15,2 zł/m).'),
    ('Taśma LED Neon Flex Slim 4x8mm IP67 6,2W/m 24V DC (rolka 25m)', 'rolka 25m', 379.00,
     'Belmeb. 24V IP67 6,2W/m Neon Flex Slim 4x8mm. Rolka 25m (~15,2 zł/m).'),
    ('Taśma LED Neon Flex IP65 12W/m 24V DC PREMIUM (rolka 5m)', 'rolka 5m', 169.00,
     'Belmeb. PREMIUM. 24V IP65 12W/m Neon Flex. Cena rolka 5m (25m=757 zł → ~30,3 zł/m) — DŁUGOŚĆ DO POTWIERDZENIA.'),
    ('Taśma LED Neon Flex IP65 12W/m 24V DC PREMIUM (rolka 25m)', 'rolka 25m', 757.00,
     'Belmeb. PREMIUM. 24V IP65 12W/m Neon Flex. Rolka 25m (~30,3 zł/m).'),
    ('Zasilacz LED 24V DC 24W STANDARD PLUS', 'szt', 37.00,
     'Belmeb. Zasilacz LED 24V DC 24W, seria STANDARD PLUS. (Artur podał ''24W'' — założono 24V.)'),
    ('Zasilacz LED 24V DC 54W STANDARD PLUS', 'szt', 65.00, 'Belmeb. Zasilacz LED 24V DC 54W, seria STANDARD PLUS.'),
    ('Zasilacz LED 24V DC 80W STANDARD PLUS', 'szt', 89.00, 'Belmeb. Zasilacz LED 24V DC 80W, seria STANDARD PLUS.'),
    ('Zasilacz do LED PREMIUM 24V DC 150W', 'szt', 159.00, 'Belmeb. Zasilacz LED PREMIUM 24V DC 150W. Dobór mocy: suma W taśmy + ~20% zapasu.'),
    ('Wyłącznik podblatowy ze ściemniaczem', 'szt', 57.00, 'Belmeb. Wyłącznik podblatowy ze ściemniaczem do systemów LED.'),
    ('Wyłącznik przyciskowy ze ściemniaczem W02', 'szt', 35.90, 'Belmeb. Wyłącznik przyciskowy ze ściemniaczem, model W02.'),
    ('Wyłącznik XC60 dotykowy profilowy', 'szt', 29.00, 'Belmeb. Wyłącznik dotykowy XC60 montowany w profilu LED.'),
    ('Profil aluminiowy INLINE 2 m', 'szt', 30.90, 'Belmeb. Profil aluminiowy INLINE, dł. 2m.'),
    ('Profil LED LUMINES wpuszczany B, srebrny anodowany, 3,00 mb', 'szt', 40.10,
     'Belmeb. Kod 03.PROF.LUMINES.B3.AL. Profil wpuszczany (frezowany), min. głębokość 9mm. Dł. 3m. Klosz osobno.'),
    ('Profil LED LUMINES wpuszczany B, czarny, 3,00 mb', 'szt', 48.39,
     'Belmeb. Kod 03.PROF.LUMINES.B3.CZ. Profil wpuszczany (frezowany). Dł. 3m. Klosz osobno.'),
    ('Klosz nakładany do profilu LUMINES, mleczny, 3,00 mb', 'szt', 7.91,
     'Belmeb. Klosz nakładany (wciskany od góry) do profilu LUMINES B. Dł. 3m. Cena z belmeb.pl 2026-06-10.'),
    ('Klosz nakładany do profilu LUMINES, czarny, 3,00 mb', 'szt', 23.60,
     'Belmeb. Klosz nakładany do profilu LUMINES B. Dł. 3m. Cena z belmeb.pl 2026-06-10.')
  ) as x(name, unit, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc
    where mc.user_id = v_user and mc.name = x.name
  );
end $$;
