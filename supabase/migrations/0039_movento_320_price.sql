-- 0039: cena prowadnicy Movento 320mm (760H3200S) — była NULL (na zamówienie).
-- 130 zł, cena z Allegro podana przez Artura 2026-06-11. Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  update public.material_catalog
     set default_price_gross = 130.00,
         notes = 'Cena z Allegro (130 zł, podana przez Artura 2026-06-11). Pełny wysuw, drewniane boki, wymaga sprzęgła T51.7601 (L+P).'
   where user_id = v_user
     and name = 'Prowadnica Movento z Blumotion Blum 760H3200S 320mm 40kg (komplet, do skrzynkowej)';
end $$;
