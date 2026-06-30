-- 0021: uchwyt frezowany NK należy do JUKA (frezowanie robione we froncie lakierowanym),
-- nie do Mercury. Wymusza supplier='JUKA', by pozycja grupowała się z frontami JUKA
-- na liście zakupów (bez tego heurystyka /uchwyt/ wrzuca ją pod Mercury).
-- Idempotentne. Dotyczy seeda z 0017 (wstawionego z supplier NULL, bo kolumna doszła w 0019).

do $$
declare
  v_user uuid;
begin
  select id into v_user
  from auth.users
  where email = 'bmw328m52@gmail.com'
  limit 1;

  if v_user is null then
    raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com';
  end if;

  update public.material_catalog
  set supplier = 'JUKA'
  where user_id = v_user
    and name = 'Uchwyt frezowany NK / FS / F45ST';
end $$;
