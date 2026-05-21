-- ============================================================
-- cost_lines: usunięcie faktury kasuje też jej pozycje kosztowe
-- (wcześniej "set null" zostawiało osierocone koszty ogólne)
-- ============================================================

-- 1. wyczyść istniejące sieroty po usuniętych fakturach/zleceniach
delete from public.cost_lines
where invoice_id is null and job_id is null;

-- 2. zmień FK: invoice_id -> on delete cascade
alter table public.cost_lines
  drop constraint if exists cost_lines_invoice_id_fkey;

alter table public.cost_lines
  add constraint cost_lines_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete cascade;
