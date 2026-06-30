-- 0030: Aventos HK-XS — mocowanie frontu drewnianego (do płyty wiórowej) + 5 kompletów.
-- Komplet = siłownik + mocowanie korpusu 20K5101 (2,51) + mocowanie frontu drewn. 20K4101 (1,72).
-- Ceny brutto sklep.merkuryam.pl 2026-06-08. Na 1 stronę korpusu (HK-XS symetryczny). Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, x.unit, 'Aventos', 'Mercury', x.gross, x.notes
  from (values
    ('Mocowanie frontu drewnianego Aventos HK-XS Blum 20K4101 (na wkręty)', 'szt', 1.72::numeric,
     'Do frontów drewnianych / płyty wiórowej (odpowiednik aluminiowego 20K4101A).'),
    ('KOMPLET Aventos HK-XS 20K1101T TIP-ON moc 180-800 + mocowania do płyty wiórowej', 'kpl', 46.89::numeric,
     'Siłownik 20K1101T TIP-ON (42,66) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu.'),
    ('KOMPLET Aventos HK-XS 20K1301 moc 500-1500 + mocowania do płyty wiórowej', 'kpl', 43.86::numeric,
     'Siłownik 20K1301 (39,63) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu.'),
    ('KOMPLET Aventos HK-XS 20K1301T TIP-ON moc 500-1200 + mocowania do płyty wiórowej', 'kpl', 46.89::numeric,
     'Siłownik 20K1301T TIP-ON (42,66) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu.'),
    ('KOMPLET Aventos HK-XS 20K1501 moc 800-1800 + mocowania do płyty wiórowej', 'kpl', 43.86::numeric,
     'Siłownik 20K1501 (39,63) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu.'),
    ('KOMPLET Aventos HK-XS 20K1501T TIP-ON moc 800-1600 + mocowania do płyty wiórowej', 'kpl', 46.89::numeric,
     'Siłownik 20K1501T TIP-ON (42,66) + 20K5101 (2,51) + 20K4101 (1,72). Na 1 stronę korpusu.')
  ) as x(name, unit, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );
end $$;
