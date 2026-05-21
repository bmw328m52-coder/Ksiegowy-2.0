-- Rozszerza enum job_status z 5 do 13 wartości: 12 etapów workflow + 'cancelled'.
-- Mapowanie istniejących rekordów:
--   planned     -> to_measure
--   in_progress -> in_production
--   completed   -> installed
--   paid        -> settled
--   cancelled   -> cancelled (bez zmian)
--   (cokolwiek innego / NULL) -> to_measure  (bezpieczny fallback)

begin;

create type public.job_status_new as enum (
  'new_inquiry',
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
  using (
    case status::text
      when 'planned'     then 'to_measure'::public.job_status_new
      when 'in_progress' then 'in_production'::public.job_status_new
      when 'completed'   then 'installed'::public.job_status_new
      when 'paid'        then 'settled'::public.job_status_new
      when 'cancelled'   then 'cancelled'::public.job_status_new
      else 'to_measure'::public.job_status_new
    end
  );

drop type public.job_status;
alter type public.job_status_new rename to job_status;

alter table public.jobs alter column status set default 'to_measure'::public.job_status;

commit;
