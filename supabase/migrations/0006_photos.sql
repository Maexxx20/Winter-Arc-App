-- Nordwand – Tagebuch-Fotos im Sync
-- Nach 0005_challenges.sql im SQL Editor ausführen. Mehrfach ausführbar.
--
-- Fotos sieht nur die Person selbst – auch Crew-Mitglieder nicht.

-- Welche Fotos gehören zu einem Tag? (Dateinamen, z. B. "photos/<id>.jpg")
alter table public.day_entries add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.day_entries drop constraint if exists day_entries_photos_array;
alter table public.day_entries add constraint day_entries_photos_array
  check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 10);

-- Privater Bucket; Pfad "<user-id>/<id>.jpg". Max. 5 MB, nur JPEG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Besitzer = erster Ordner im Pfad (Funktion aus 0004).
drop policy if exists "photos read own" on storage.objects;
create policy "photos read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.avatar_owner(name) = (select auth.uid()));

drop policy if exists "photos upload own" on storage.objects;
create policy "photos upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.avatar_owner(name) = (select auth.uid()));

drop policy if exists "photos update own" on storage.objects;
create policy "photos update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.avatar_owner(name) = (select auth.uid()))
  with check (bucket_id = 'photos' and public.avatar_owner(name) = (select auth.uid()));

drop policy if exists "photos delete own" on storage.objects;
create policy "photos delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.avatar_owner(name) = (select auth.uid()));
