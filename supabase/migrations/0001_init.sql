-- ============================================================
-- Manager Firmy — schema początkowa (Etap 1)
-- ============================================================

-- Trigger pomocniczy: auto-aktualizacja updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- KLIENCI (B2B / B2C)
-- ============================================================
create type public.client_type as enum ('company', 'individual');

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        public.client_type not null,
  name        text not null,
  nip         text,
  address     text,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index clients_user_idx on public.clients(user_id);
create index clients_name_idx on public.clients(user_id, lower(name));

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "clients_own_select" on public.clients for select using (auth.uid() = user_id);
create policy "clients_own_insert" on public.clients for insert with check (auth.uid() = user_id);
create policy "clients_own_update" on public.clients for update using (auth.uid() = user_id);
create policy "clients_own_delete" on public.clients for delete using (auth.uid() = user_id);

-- ============================================================
-- ZLECENIA
-- ============================================================
create type public.job_status as enum ('planned', 'in_progress', 'completed', 'paid', 'cancelled');

create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete restrict,
  title           text not null,
  amount_gross    numeric(12, 2) not null default 0,
  vat_rate        numeric(5, 4) not null default 0.23,
  status          public.job_status not null default 'planned',
  start_date      date,
  due_date        date,
  completed_date  date,
  paid_date       date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index jobs_user_idx   on public.jobs(user_id);
create index jobs_client_idx on public.jobs(client_id);
create index jobs_status_idx on public.jobs(user_id, status);

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;

create policy "jobs_own_select" on public.jobs for select using (auth.uid() = user_id);
create policy "jobs_own_insert" on public.jobs for insert with check (auth.uid() = user_id);
create policy "jobs_own_update" on public.jobs for update using (auth.uid() = user_id);
create policy "jobs_own_delete" on public.jobs for delete using (auth.uid() = user_id);

-- ============================================================
-- FAKTURY KOSZTOWE (dokumenty z OCR)
-- ============================================================
create type public.ocr_status as enum ('pending', 'processing', 'done', 'failed', 'manual');

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  file_path       text not null,
  file_mime       text,
  ocr_status      public.ocr_status not null default 'pending',
  ocr_raw         jsonb,
  supplier_name   text,
  supplier_nip    text,
  invoice_number  text,
  issue_date      date,
  payment_due     date,
  amount_net      numeric(12, 2),
  amount_vat      numeric(12, 2),
  amount_gross    numeric(12, 2),
  vat_rate        numeric(5, 4),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index invoices_user_idx   on public.invoices(user_id);
create index invoices_status_idx on public.invoices(user_id, ocr_status);
create index invoices_date_idx   on public.invoices(user_id, issue_date);

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;

create policy "invoices_own_select" on public.invoices for select using (auth.uid() = user_id);
create policy "invoices_own_insert" on public.invoices for insert with check (auth.uid() = user_id);
create policy "invoices_own_update" on public.invoices for update using (auth.uid() = user_id);
create policy "invoices_own_delete" on public.invoices for delete using (auth.uid() = user_id);

-- ============================================================
-- POZYCJE KOSZTÓW (przypisane do zlecenia lub ogólne)
-- ============================================================
create table public.cost_lines (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  invoice_id    uuid references public.invoices(id) on delete set null,
  job_id        uuid references public.jobs(id) on delete set null, -- null = koszt ogólny
  description   text not null,
  amount_net    numeric(12, 2) not null default 0,
  amount_vat    numeric(12, 2) not null default 0,
  amount_gross  numeric(12, 2) not null default 0,
  vat_rate      numeric(5, 4),
  category      text,
  cost_date     date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index cost_lines_user_idx    on public.cost_lines(user_id);
create index cost_lines_invoice_idx on public.cost_lines(invoice_id);
create index cost_lines_job_idx     on public.cost_lines(job_id);
create index cost_lines_date_idx    on public.cost_lines(user_id, cost_date);

create trigger cost_lines_updated_at
  before update on public.cost_lines
  for each row execute function public.set_updated_at();

alter table public.cost_lines enable row level security;

create policy "cost_lines_own_select" on public.cost_lines for select using (auth.uid() = user_id);
create policy "cost_lines_own_insert" on public.cost_lines for insert with check (auth.uid() = user_id);
create policy "cost_lines_own_update" on public.cost_lines for update using (auth.uid() = user_id);
create policy "cost_lines_own_delete" on public.cost_lines for delete using (auth.uid() = user_id);

-- ============================================================
-- USTAWIENIA UŻYTKOWNIKA
-- ============================================================
create type public.tax_form as enum ('skala', 'liniowy');
create type public.vat_period as enum ('monthly', 'quarterly');

create table public.user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  business_name        text default 'LUVIANO',
  business_nip         text,
  tax_form             public.tax_form not null default 'skala',
  vat_period           public.vat_period not null default 'monthly',
  zus_monthly          numeric(10, 2) default 0,
  health_insurance_min numeric(10, 2) default 0,
  is_vat_payer         boolean not null default true,
  default_vat_rate     numeric(5, 4) not null default 0.23,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_own_select" on public.user_settings for select using (auth.uid() = user_id);
create policy "user_settings_own_insert" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "user_settings_own_update" on public.user_settings for update using (auth.uid() = user_id);

-- ============================================================
-- STORAGE: bucket dla faktur (skany / zdjęcia)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- Pliki przechowywane w ścieżce {user_id}/{filename}
create policy "invoices_storage_own_select"
  on storage.objects for select
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "invoices_storage_own_insert"
  on storage.objects for insert
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "invoices_storage_own_update"
  on storage.objects for update
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "invoices_storage_own_delete"
  on storage.objects for delete
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
