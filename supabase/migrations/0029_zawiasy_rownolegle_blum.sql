-- 0029: trzy zawiasy równoległe Blum (na życzenie Artura).
-- Ceny brutto sklep.merkuryam.pl 2026-06-08 (potwierdzone na kartach produktów). Idempotentne.

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = 'bmw328m52@gmail.com' limit 1;
  if v_user is null then raise exception 'Nie znaleziono użytkownika bmw328m52@gmail.com'; end if;

  insert into public.material_catalog (user_id, name, unit, category, supplier, default_price_gross, notes)
  select v_user, x.name, 'szt', 'Zawiasy', 'Mercury', x.gross, x.notes
  from (values
    ('Zawias równoległy wpuszczany Blum 79B9550 BLUMOTION Clip-T 95° (nikiel)', 17.82::numeric,
     'Równoległy z wbudowanym Blumotion (cichy domyk). Wersja nikiel; onyks osobno: 19,19.'),
    ('Zawias równoległy Blum 78T9550.83 Clip-T 83° bez sprężyny', 11.08::numeric,
     'Równoległy 83° BEZ sprężyny — do TIP-ON lub mechanizmów bez automatu domykania.'),
    ('Zawias równoległy nakładany Blum 79T9950.37 Clip-T 95° ze sprężyną', 20.49::numeric,
     'Równoległy NAKŁADANY 95° ze sprężyną (nie wpuszczany jak 79T9550/79B9550).')
  ) as x(name, gross, notes)
  where not exists (
    select 1 from public.material_catalog mc where mc.user_id = v_user and mc.name = x.name
  );
end $$;
