-- Nordwand – Crew-Arc: eine Vorlage (Zeitraum + Regeln) für die ganze Crew
-- Nach 0010_push_nudge.sql im SQL Editor ausführen. Mehrfach ausführbar.
--
-- Ein Mitglied legt Zeitraum und Regeln fest. Wer mitmacht, übernimmt die Vorlage und
-- unterschreibt seinen eigenen Vertrag – danach kann jede Person ihren Arc wie gewohnt ändern.
-- Im Tagesstatus steht zusätzlich, welche Vorlagen-Regeln erledigt sind (Vergleich Regel für Regel).

create table if not exists public.crew_arcs (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  why text not null default '' check (char_length(why) <= 500),
  start_date date not null,
  end_date date not null,
  -- Regeln wie in der App: [{ id, title, icon, category, frequency, measure }]
  rules jsonb not null check (jsonb_typeof(rules) = 'array' and jsonb_array_length(rules) between 1 and 10),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 365),
  check (octet_length(rules::text) <= 20000)
);
create index if not exists crew_arcs_crew on public.crew_arcs (crew_id, start_date desc);

-- Regeln prüfen, damit eine kaputte Vorlage niemandem die App stört
create or replace function public.valid_crew_arc_rules(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) between 1 and 10
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where not (
        jsonb_typeof(e) = 'object'
        and jsonb_typeof(e -> 'id') = 'string' and char_length(e ->> 'id') between 1 and 64
        and jsonb_typeof(e -> 'title') = 'string' and char_length(e ->> 'title') between 1 and 80
        and jsonb_typeof(e -> 'icon') = 'string' and char_length(e ->> 'icon') <= 16
        and jsonb_typeof(e -> 'category') = 'string' and char_length(e ->> 'category') <= 20
        and jsonb_typeof(e -> 'frequency') = 'object'
        and coalesce(
          e -> 'frequency' ->> 'kind' = 'daily'
          or (e -> 'frequency' ->> 'kind' = 'weekly'
              and jsonb_typeof(e -> 'frequency' -> 'times') = 'number'
              and (e -> 'frequency' ->> 'times') ~ '^[1-7]$'),
          false)
        and jsonb_typeof(e -> 'measure') = 'object'
        and coalesce(
          e -> 'measure' ->> 'kind' = 'check'
          or (e -> 'measure' ->> 'kind' = 'amount'
              and jsonb_typeof(e -> 'measure' -> 'target') = 'number'
              and (e -> 'measure' ->> 'target') ~ '^[0-9]{1,6}(\.[0-9]{1,2})?$'
              and (e -> 'measure' ->> 'target')::numeric > 0
              and jsonb_typeof(e -> 'measure' -> 'unit') = 'string'
              and char_length(e -> 'measure' ->> 'unit') between 1 and 20),
          false)
      )
    );
$$;
alter table public.crew_arcs drop constraint if exists crew_arcs_rules_valid;
alter table public.crew_arcs add constraint crew_arcs_rules_valid check (public.valid_crew_arc_rules(rules));

-- Pro Crew höchstens eine Vorlage, die noch nicht vorbei ist; Crew und Ersteller:in bleiben fest.
create or replace function public.crew_arc_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.crew_arcs
      where crew_id = new.crew_id and end_date >= (now() at time zone 'Europe/Zurich')::date
    ) then
      raise exception 'crew_arc_exists';
    end if;
  else
    if new.id is distinct from old.id or new.crew_id is distinct from old.crew_id or new.created_by is distinct from old.created_by then
      raise exception 'crew_arc_fixed_fields';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists crew_arc_guard on public.crew_arcs;
create trigger crew_arc_guard before insert or update on public.crew_arcs
  for each row execute function public.crew_arc_guard();

create table if not exists public.crew_arc_signatures (
  crew_arc_id uuid not null references public.crew_arcs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  signed_at timestamptz not null default now(),
  primary key (crew_arc_id, user_id)
);

create or replace function public.crew_of_arc(p_arc uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select crew_id from public.crew_arcs where id = p_arc;
$$;
revoke all on function public.crew_of_arc(uuid) from public, anon;
grant execute on function public.crew_of_arc(uuid) to authenticated;

-- Wie viele andere haben schon unterschrieben? (Danach lassen sich die Regeln nicht mehr ändern.)
create or replace function public.crew_arc_others_signed(p_arc uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crew_arc_signatures s
    join public.crew_arcs a on a.id = s.crew_arc_id
    where s.crew_arc_id = p_arc and s.user_id is distinct from a.created_by
  );
$$;
revoke all on function public.crew_arc_others_signed(uuid) from public, anon;
grant execute on function public.crew_arc_others_signed(uuid) to authenticated;

alter table public.crew_arcs enable row level security;
alter table public.crew_arc_signatures enable row level security;

drop policy if exists "crew arcs read" on public.crew_arcs;
create policy "crew arcs read" on public.crew_arcs
  for select to authenticated using (public.is_crew_member(crew_id));

drop policy if exists "crew arcs create" on public.crew_arcs;
create policy "crew arcs create" on public.crew_arcs
  for insert to authenticated
  with check (public.is_crew_member(crew_id) and created_by = (select auth.uid()));

drop policy if exists "crew arcs change" on public.crew_arcs;
create policy "crew arcs change" on public.crew_arcs
  for update to authenticated
  using ((created_by = (select auth.uid()) or public.is_crew_owner(crew_id)) and not public.crew_arc_others_signed(id))
  with check (public.is_crew_member(crew_id));

drop policy if exists "crew arcs delete" on public.crew_arcs;
create policy "crew arcs delete" on public.crew_arcs
  for delete to authenticated using (created_by = (select auth.uid()) or public.is_crew_owner(crew_id));

drop policy if exists "crew arc signatures read" on public.crew_arc_signatures;
create policy "crew arc signatures read" on public.crew_arc_signatures
  for select to authenticated using (public.is_crew_member(public.crew_of_arc(crew_arc_id)));

drop policy if exists "crew arc sign" on public.crew_arc_signatures;
create policy "crew arc sign" on public.crew_arc_signatures
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_crew_member(public.crew_of_arc(crew_arc_id)));

drop policy if exists "crew arc unsign" on public.crew_arc_signatures;
create policy "crew arc unsign" on public.crew_arc_signatures
  for delete to authenticated using (user_id = (select auth.uid()));

-- Wer die Crew verlässt oder entfernt wird, zählt nicht mehr als unterschrieben
-- (sonst bliebe die Vorlage für die Ersteller:in gesperrt).
create or replace function public.crew_arc_signature_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.crew_arc_signatures s
  using public.crew_arcs a
  where a.id = s.crew_arc_id and a.crew_id = old.crew_id and s.user_id = old.user_id;
  return null;
end;
$$;
drop trigger if exists crew_arc_signature_cleanup on public.crew_members;
create trigger crew_arc_signature_cleanup after delete on public.crew_members
  for each row execute function public.crew_arc_signature_cleanup();

-- Tagesstatus: zu welchem Crew-Arc und welche seiner Regeln heute erledigt sind
alter table public.daily_status add column if not exists crew_arc_id uuid;
alter table public.daily_status add column if not exists rules_done text[];
alter table public.daily_status drop constraint if exists daily_status_rules_done_len;
alter table public.daily_status add constraint daily_status_rules_done_len
  check (rules_done is null or cardinality(rules_done) <= 10);

-- Live-Updates in der Crew
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crew_arc_signatures'
     ) then
    alter publication supabase_realtime add table public.crew_arc_signatures;
  end if;
end;
$$;

-- Mitteilung an die Crew, wenn ein Crew-Arc startet
create or replace function public.notify_crew_arc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew text;
  v_name text;
  v_other uuid;
begin
  if new.created_by is null then
    return null;
  end if;
  select name into v_crew from public.crews where id = new.crew_id;
  v_name := public.crew_display_name(new.crew_id, new.created_by);
  for v_other in select user_id from public.crew_members where crew_id = new.crew_id and user_id <> new.created_by loop
    if not public.blocked_between(new.created_by, v_other) and public.push_allowed(new.crew_id, new.created_by, v_other, 'crew_arc') then
      perform public.send_push_i18n(v_other, coalesce(v_crew, 'Nordwand'), 'crew_arc', v_name, new.title, '/crew/' || new.crew_id);
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists notify_crew_arc on public.crew_arcs;
create trigger notify_crew_arc after insert on public.crew_arcs
  for each row execute function public.notify_crew_arc();
