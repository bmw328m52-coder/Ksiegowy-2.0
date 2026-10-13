-- ============================================================
-- Zdjęcia punktów instalacji ze skanera iPad (LUVIANO Skaner).
-- Bucket prywatny; ścieżka {user_id}/{photo_id}.jpg — id zdjęć
-- są w room_scans.data.markers[].photos.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scan-photos', 'scan-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "scan_photos_own_select" on storage.objects;
drop policy if exists "scan_photos_own_insert" on storage.objects;
drop policy if exists "scan_photos_own_update" on storage.objects;
drop policy if exists "scan_photos_own_delete" on storage.objects;

create policy "scan_photos_own_select"
  on storage.objects for select
  using (bucket_id = 'scan-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "scan_photos_own_insert"
  on storage.objects for insert
  with check (bucket_id = 'scan-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "scan_photos_own_update"
  on storage.objects for update
  using (bucket_id = 'scan-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "scan_photos_own_delete"
  on storage.objects for delete
  using (bucket_id = 'scan-photos' and (storage.foldername(name))[1] = auth.uid()::text);
