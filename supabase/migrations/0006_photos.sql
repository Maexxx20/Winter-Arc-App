-- Nordwand – Tagebuch-Fotos im Sync
-- Nach 0005_challenges.sql im SQL Editor ausführen. Mehrfach ausführbar.
--
-- Jedes Foto ist ein eigener Datensatz (neuere Version gewinnt, Löschen = Löschmarke).
-- So kann ein Gerät nie versehentlich Fotos eines anderen Geräts entfernen.
-- Fotos sieht nur die Person selbst – auch Crew-Mitglieder nicht.

-- Frühere Fassung dieser Migration (Fotoliste im Tageseintrag) wieder entfernen.
alter table public.day_entries drop constraint if exists day_entries_photos_array;
alter table public.day_entries drop column if exists photos;

create table if not exists public.diary_photos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (name ~ '^photos/[A-Za-z0-9_-]+\.jpg$'), -- Dateiname auf dem Gerät
  arc_id uuid not null references public.arcs (id) on delete cascade,
  date date not null,
  deleted boolean not null default false,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, name)
);
create index if not exists diary_photos_user_sync on public.diary_photos (user_id, server_updated_at);

drop trigger if exists keep_newer on public.diary_photos;
create trigger keep_newer before insert or update on public.diary_photos for each row execute function public.keep_newer();

alter table public.diary_photos enable row level security;
drop policy if exists "own photos" on public.diary_photos;
create policy "own photos" on public.diary_photos
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Privater Bucket; Pfad "<user-id>/<id>.jpg". Max. 10 MB, nur JPEG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg'])
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
