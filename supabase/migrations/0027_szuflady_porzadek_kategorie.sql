-- 0027: porządek w szufladach — w cenniku w głównej kategorii "Szuflady" mają być
-- widoczne TYLKO gotowe zestawy Merivobox; luźne komponenty lądują w osobnej
-- kategorii "Szuflady — części" i schodzą pod zestawy.
--
-- Taksonomia docelowa:
--   "Szuflady"          → 16 gotowych zestawów Merivobox (było: "Szuflady komplety")
--   "Szuflady — części" → boki, prowadnice Merivobox/Movento, relingi, boxcap,
--                          mocowania, uchwyty, fronty wewn., sprzęgło, legacy Legrabox/Tandembox
--   "Wkłady szuflad"    → bez zmian (Orga-Line)
--
-- Idempotentne i bezpieczne niezależnie od kolejności importu seeda:
--   • części przenosimy po warunku "nie jest zestawem" (name NOT LIKE 'Zestaw szuflady%'),
--     więc nigdy nie ruszymy gotowych zestawów stojących w "Szuflady";
--   • zestawy z dawnej "Szuflady komplety" zmieniamy na "Szuflady".

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  -- (1) Luźne części → "Szuflady — części" (wszystko, co nie jest gotowym zestawem,
  --     a siedzi w dawnych kategoriach komponentów). Robione PRZED (2), by opróżnić "Szuflady".
  update public.material_catalog
  set category = 'Szuflady — części'
  where user_id = v_user
    and category in ('Szuflady', 'Prowadnice szuflad')
    and name not like 'Zestaw szuflady%';

  -- (2) Gotowe zestawy → główna kategoria "Szuflady".
  update public.material_catalog
  set category = 'Szuflady'
  where user_id = v_user
    and category = 'Szuflady komplety';
end $$;
