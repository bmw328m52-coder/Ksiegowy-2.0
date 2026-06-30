-- 0032: klips do nóżki MULTI LEG jako osobna pozycja + poprawka ceny gołego siłownika
-- HK-XS 20K1501T (było 46,89 = cena „z mocowaniami"; goły siłownik = 42,66). Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, 'Klips do nóżki MULTI LEG czarny 450kg (opak. 2 szt)', 'kpl', 'Nogi', 'Mercury', 2.00,
         'Zatrzask cokołu do nóżki MULTI LEG. Merkury: opak. 2 szt.'
  where not exists (
    select 1 from public.material_catalog mc
    where mc.user_id = v_user and mc.name = 'Klips do nóżki MULTI LEG czarny 450kg (opak. 2 szt)'
  );

  update public.material_catalog set default_price_gross = 42.66
  where user_id = v_user
    and name = 'Siłownik Aventos HK-XS Blum 20K1501T TIP-ON, moc 800-1600'
    and default_price_gross = 46.89;
end $$;
