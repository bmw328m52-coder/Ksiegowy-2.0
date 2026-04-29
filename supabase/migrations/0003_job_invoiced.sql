-- Fakturowanie sprzedażowe na zleceniach
alter table public.jobs
  add column if not exists invoiced       boolean not null default false,
  add column if not exists invoice_number text,
  add column if not exists invoice_date   date;

create index if not exists jobs_invoiced_idx on public.jobs(user_id, invoiced);
