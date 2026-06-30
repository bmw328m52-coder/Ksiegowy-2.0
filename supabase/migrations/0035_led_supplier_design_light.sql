-- 0035: korekta dostawcy LED 2026-06-11 (Artur). Ceny taśm/zasilaczy/wyłączników/profilu INLINE
-- pochodzą z Design Light; przy Belmebie zostają TYLKO profile LUMINES + klosze (zawierają "LUMINES").
-- Reguła: kat. 'Oświetlenie LED' + supplier 'Belmeb' + name NOT LIKE '%LUMINES%' → 'Design Light'.
-- Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  update public.material_catalog
     set supplier = 'Design Light'
   where user_id = v_user
     and category = 'Oświetlenie LED'
     and supplier = 'Belmeb'
     and name not like '%LUMINES%';
end $$;
