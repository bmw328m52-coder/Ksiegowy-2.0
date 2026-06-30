-- 0040: cena zasilacza 100W Design Light potwierdzona przez Artura 2026-06-11 (109 zł — już nie orientacyjna).
-- Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  update public.material_catalog
     set default_price_gross = 109.00,
         notes = 'Design Light. Cena 109 zł potwierdzona przez Artura 2026-06-11. Wypełnia lukę między 80W a 150W.'
   where user_id = v_user
     and name = 'Zasilacz LED 24V DC 100W meblowy Design Light';
end $$;
