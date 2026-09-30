-- Nordwand – Abzeichen für Crews und Wochen-Challenges
-- Nach 0004_profiles.sql im SQL Editor ausführen. Mehrfach ausführbar.

-- ---------- Abzeichen im Profil (sichtbar für Crew-Mitglieder wie der Rest des Profils) ----------

-- Liste der verdienten Abzeichen: [{"id": "streak_7", "date": "2026-10-07"}, …]
alter table public.profiles add column if not exists badges jsonb not null default '[]'::jsonb;
alter table public.profiles drop constraint if exists profiles_badges_array;
alter table public.profiles add constraint profiles_badges_array
  check (jsonb_typeof(badges) = 'array' and jsonb_array_length(badges) <= 200);

-- ---------- Wochen-Challenges ----------

create table if not exists public.crew_challenges (
  crew_id uuid not null references public.crews (id) on delete cascade,
  week date not null check (extract(isodow from week) = 1), -- Montag
  -- crew_total: zusammen X gehaltene Tage; everyone: jede Person mindestens X Tage
  kind text not null check (kind in ('crew_total', 'everyone')),
  target smallint not null check (target between 1 and 140),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (crew_id, week)
);

alter table public.crew_challenges enable row level security;

-- Besitzer:in der Crew?
create or replace function public.is_crew_owner(p_crew uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.crews c where c.id = p_crew and c.created_by = (select auth.uid()));
$$;
revoke all on function public.is_crew_owner(uuid) from public, anon;
grant execute on function public.is_crew_owner(uuid) to authenticated;

drop policy if exists "challenges read" on public.crew_challenges;
create policy "challenges read" on public.crew_challenges
  for select to authenticated using (public.is_crew_member(crew_id));

-- Jedes Mitglied darf eine Challenge starten …
drop policy if exists "challenges create" on public.crew_challenges;
create policy "challenges create" on public.crew_challenges
  for insert to authenticated
  with check (public.is_crew_member(crew_id) and created_by = (select auth.uid()));

-- … ändern oder löschen nur, wer sie gestartet hat, oder der Besitzer der Crew.
drop policy if exists "challenges change" on public.crew_challenges;
create policy "challenges change" on public.crew_challenges
  for update to authenticated
  using ((created_by = (select auth.uid()) or public.is_crew_owner(crew_id)) and public.is_crew_member(crew_id))
  with check (public.is_crew_member(crew_id));

drop policy if exists "challenges delete" on public.crew_challenges;
create policy "challenges delete" on public.crew_challenges
  for delete to authenticated
  using ((created_by = (select auth.uid()) or public.is_crew_owner(crew_id)) and public.is_crew_member(crew_id));

-- Live-Updates
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crew_challenges'
  ) then
    alter publication supabase_realtime add table public.crew_challenges;
  end if;
end;
$$;
