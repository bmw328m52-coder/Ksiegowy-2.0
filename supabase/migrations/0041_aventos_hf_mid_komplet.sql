-- 0041: Aventos HF — środkowy komplet H-560-710mm (decyzja Artura 2026-06-12).
-- Merkury nie listuje siłownika 20F2500.05, więc cena kompletu = POŚREDNIA (średnia)
-- między sąsiednimi kompletami: (335,92 + 394,24)/2 = 365,08 zł.
-- Zamienia dotychczasowy wpis "TYLKO RAMIĘ" (20F3500) na pełny komplet. Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  -- usuń stary wpis "TYLKO RAMIĘ" (zastąpiony kompletem)
  delete from public.material_catalog
   where user_id = v_user
     and name = 'Zestaw podnośników Aventos HF Blum 20F3500 H-560-710mm (TYLKO RAMIĘ)';

  -- dodaj/odśwież komplet środkowy
  if exists (
    select 1 from public.material_catalog
     where user_id = v_user
       and name = 'KOMPLET Aventos HF H-560-710mm: ramię 20F3500 + siłownik 20F2500.05 + zaślepki 20F8020'
  ) then
    update public.material_catalog
       set default_price_gross = 365.08,
           category = 'Aventos',
           notes = 'Ramię 20F3500 (110,81) + siłownik 20F2500.05 moc 5350-10150 + zaślepki 20F8020 L+P (35,36). Merkury nie listuje siłownika 20F2500.05, więc cena kompletu = pośrednia (średnia) między H-480-570 (335,92) a H-700-900 (394,24) = 365,08. Decyzja Artura 2026-06-12.'
     where user_id = v_user
       and name = 'KOMPLET Aventos HF H-560-710mm: ramię 20F3500 + siłownik 20F2500.05 + zaślepki 20F8020';
  else
    insert into public.material_catalog (user_id, name, unit, default_price_gross, category, notes)
    values (
      v_user,
      'KOMPLET Aventos HF H-560-710mm: ramię 20F3500 + siłownik 20F2500.05 + zaślepki 20F8020',
      'kpl',
      365.08,
      'Aventos',
      'Ramię 20F3500 (110,81) + siłownik 20F2500.05 moc 5350-10150 + zaślepki 20F8020 L+P (35,36). Merkury nie listuje siłownika 20F2500.05, więc cena kompletu = pośrednia (średnia) między H-480-570 (335,92) a H-700-900 (394,24) = 365,08. Decyzja Artura 2026-06-12.'
    );
  end if;
end $$;
