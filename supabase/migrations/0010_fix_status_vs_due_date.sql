-- ============================================================
-- Jednorazowa naprawa: zlecenia ze statusem 'completed'/'paid'
-- ale terminem realizacji w przyszłości — wracają do in_progress/planned.
-- Walidacja na zapis (w app) zapobiega tworzeniu nowych takich rozjazdów.
-- ============================================================

update public.jobs
set
  status = case
    when start_date is not null and start_date <= current_date then 'in_progress'::public.job_status
    else 'planned'::public.job_status
  end,
  completed_date = null,
  paid_date = null
where status in ('completed', 'paid')
  and due_date is not null
  and due_date > current_date;
