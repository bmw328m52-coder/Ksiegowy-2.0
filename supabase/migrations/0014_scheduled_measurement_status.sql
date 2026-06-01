-- Dodaje 'scheduled_measurement' do enum job_status (przed 'to_measure').
-- Wzorowane na 0013_job_status_12stage.sql.
--
-- Mapowanie istniejących rekordów: wszystkie statusy zachowują wartość (1:1),
-- po prostu rozszerzamy enum o 1 nową pozycję.

begin;

create type public.job_status_new as enum (
  'new_inquiry',
  'scheduled_measurement',
  'to_measure',
  'after_measure',
  'to_quote',
  'quote_sent',
  'accepted',
  'materials_ordered',
  'in_production',
  'ready_to_install',
  'installed',
  'settled',
  'archived',
  'cancelled'
);

alter table public.jobs alter column status drop default;

alter table public.jobs
  alter column status type public.job_status_new
  using status::text::public.job_status_new;

drop type public.job_status;
alter type public.job_status_new rename to job_status;

alter table public.jobs alter column status set default 'to_measure'::public.job_status;

commit;
