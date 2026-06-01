-- 0018: materiały na wycenie mogą być przypięte do grupy wyceny (Fronty, Okucia, ...)
-- group_key NULL = "luźne" materiały (sekcja na dole wyceny).

alter table public.job_materials
  add column if not exists group_key text;

create index if not exists job_materials_job_group_idx
  on public.job_materials(job_id, group_key);
