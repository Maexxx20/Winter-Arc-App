-- Nordwand – Profile (Profilbild, Motto, Instagram)
-- Nach 0003_realtime.sql im SQL Editor ausführen. Mehrfach ausführbar.
--
-- Crew-Mitglieder sehen gegenseitig Name, Motto, Instagram-Name und Profilbild.
-- Wer in keiner gemeinsamen Crew ist, sieht nichts davon.

-- ---------- Profilfelder ----------

alter table public.profiles add column if not exists motto text not null default '';
alter table public.profiles add column if not exists instagram text not null default '';
-- Pfad im Speicher-Bucket "avatars", z. B. "<user-id>/1727712000000.jpg". Null = kein Bild.
alter table public.profiles add column if not exists avatar_path text;

-- Ältere Einträge an die neuen Regeln anpassen, damit die Prüfungen greifen können.
update public.profiles set name = left(name, 40) where char_length(name) > 40;

alter table public.profiles drop constraint if exists profiles_name_len;
alter table public.profiles add constraint profiles_name_len check (char_length(name) <= 40);
alter table public.profiles drop constraint if exists profiles_motto_len;
alter table public.profiles add constraint profiles_motto_len check (char_length(motto) <= 80);
alter table public.profiles drop constraint if exists profiles_instagram_format;
alter table public.profiles add constraint profiles_instagram_format check (instagram ~ '^[A-Za-z0-9._]{0,30}$');
alter table public.profiles drop constraint if exists profiles_avatar_own;
alter table public.profiles add constraint profiles_avatar_own check (avatar_path is null or avatar_path like id::text || '/%');

-- Crew-Mitglieder dürfen das Profil lesen (eigenes Profil: Policy "own profile" aus 0001).
drop policy if exists "crew mates read profile" on public.profiles;
create policy "crew mates read profile" on public.profiles
  for select to authenticated using (public.is_crew_mate(id));

-- Namensänderung im Profil gilt in allen eigenen Crews.
create or replace function public.profile_name_to_crews()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(trim(new.name)) between 1 and 40 then
    update public.crew_members
      set display_name = trim(new.name)
      where user_id = new.id and display_name <> trim(new.name);
  end if;
  return null;
end;
$$;

drop trigger if exists profile_name_to_crews on public.profiles;
drop trigger if exists profile_name_to_crews_insert on public.profiles;
drop trigger if exists profile_name_to_crews_update on public.profiles;
create trigger profile_name_to_crews_insert after insert on public.profiles
  for each row execute function public.profile_name_to_crews();
-- Nur bei echter Namensänderung (ein Upsert schreibt die Spalte immer mit).
create trigger profile_name_to_crews_update after update of name on public.profiles
  for each row when (old.name is distinct from new.name) execute function public.profile_name_to_crews();

-- ---------- Speicher für Profilbilder ----------

-- Privater Bucket: Bilder sind nur über zeitlich begrenzte Links abrufbar,
-- und nur für die Person selbst und ihre Crew-Mitglieder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Besitzer eines Bildes = erster Ordner im Pfad. Liefert null bei ungültigem Pfad.
create or replace function public.avatar_owner(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;

drop policy if exists "avatars upload own" on storage.objects;
create policy "avatars upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and public.avatar_owner(name) = (select auth.uid()));

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and public.avatar_owner(name) = (select auth.uid()))
  with check (bucket_id = 'avatars' and public.avatar_owner(name) = (select auth.uid()));

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.avatar_owner(name) = (select auth.uid()));

drop policy if exists "avatars read crew" on storage.objects;
create policy "avatars read crew" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.is_crew_mate(public.avatar_owner(name)));
