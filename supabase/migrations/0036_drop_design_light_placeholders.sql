-- 0036: usunięcie 2 starych placeholderów Design Light (seedowane w 0020/0023, ceny orientacyjne),
-- zastąpionych realnymi pozycjami Belmeb/Design Light z 0033. Decyzja Artura 2026-06-11.
-- ZOSTAJE: "Zasilacz LED 24V DC 100W meblowy Design Light" (wypełnia lukę 80-150W).
-- Uwaga: w żywej bazie linia w zleceniu "Kuchnia" używająca taśmy CRI90 została wcześniej
-- przepięta na realną "Taśma COB 480 ... (rolka 5m)" (operacja na danych, nie w migracji).
-- Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  delete from public.material_catalog
   where user_id = v_user
     and name in (
       'Taśma LED COB 24V CRI90+ 4000K ~13W/m Design Light (rolka 5m)',
       'Profil aluminiowy nawierzchniowy LED Design Light 2m + klosz'
     );
end $$;
