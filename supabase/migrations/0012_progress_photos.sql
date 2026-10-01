-- Nordwand – Fortschrittsfotos (Vorher/Nachher)
-- Nach 0011_crew_arcs.sql im SQL Editor ausführen. Mehrfach ausführbar.
--
-- Fortschrittsfotos liegen wie Tagebuch-Fotos im privaten Bucket «photos» und sind nur für
-- dich sichtbar. Sie gehören zu einem Arc und einem Tag, aber nicht ins Tagebuch.

alter table public.diary_photos add column if not exists kind text not null default 'diary';
alter table public.diary_photos drop constraint if exists diary_photos_kind_check;
alter table public.diary_photos add constraint diary_photos_kind_check check (kind in ('diary', 'progress'));
