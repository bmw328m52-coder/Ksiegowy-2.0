-- 0034: korekty cennika 2026-06-11 (potwierdzone przez Artura).
--  1) Zasilacz "24V DC 24W STANDARD PLUS" (37 zł) NIE ISTNIEJE → usunąć;
--     w zamian "Zasilacz LED 24V DC 33W STANDARD PLUS" 44,00 zł (Belmeb, Oświetlenie LED).
--  2) Servo-Drive UNO Z10UB00EE: 570 → 460 zł (cena zakupowa potwierdzona, bez "do weryfikacji").
--  3) Taśma COB BICOLOR 608 oraz Neon Flex IP65 PREMIUM: rolka 5m POTWIERDZONA → zdjąć "DŁUGOŚĆ DO POTWIERDZENIA".
-- Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  -- (1a) usuń nieistniejący zasilacz 24W
  delete from public.material_catalog
   where user_id = v_user and name = 'Zasilacz LED 24V DC 24W STANDARD PLUS';

  -- (1b) dodaj zasilacz 33W (jeśli go nie ma)
  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, 'Zasilacz LED 24V DC 33W STANDARD PLUS', 'szt', 'Oświetlenie LED', 'Belmeb', 44.00,
         'Belmeb. Zasilacz LED 24V DC 33W, seria STANDARD PLUS. Cena podana przez Artura 2026-06-11.'
  where not exists (
    select 1 from public.material_catalog mc
    where mc.user_id = v_user and mc.name = 'Zasilacz LED 24V DC 33W STANDARD PLUS'
  );

  -- (2) Servo-Drive UNO → 460 zł
  update public.material_catalog
     set default_price_gross = 460.00,
         notes = 'Następca Z10NA30EE. Cena zakupowa 460 zł (potwierdzona przez Artura 2026-06-11).'
   where user_id = v_user
     and name = 'Zestaw Servo-Drive UNO do stojących sortowników na śmieci (NOWA WERSJA) Blum Z10UB00EE';

  -- (3) zdejmij "DŁUGOŚĆ DO POTWIERDZENIA" (rolka 5m potwierdzona)
  update public.material_catalog
     set notes = 'Belmeb. 24V, bicolor (regulowana barwa), IP65, 14,8W/m, 608 LED/m. Cena za rolkę 5m (potwierdzone 2026-06-11).'
   where user_id = v_user
     and name = 'Taśma COB BICOLOR 608 LED/m IP65 14,8W/m 24V DC (rolka 5m)';

  update public.material_catalog
     set notes = 'Belmeb. PREMIUM. 24V IP65 12W/m Neon Flex. Cena za rolkę 5m (potwierdzone 2026-06-11; 25m=757 zł → ~30,3 zł/m).'
   where user_id = v_user
     and name = 'Taśma LED Neon Flex IP65 12W/m 24V DC PREMIUM (rolka 5m)';
end $$;
