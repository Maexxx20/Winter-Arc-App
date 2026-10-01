-- Nordwand – Crew-Arc: alle in der Crew unterschreiben denselben Vertrag
-- Nach 0010_push_nudge.sql im SQL Editor ausführen. Mehrfach ausführbar.
--
-- Wer die Crew besitzt, legt Zeitraum und Regeln fest. Jedes Mitglied kann unterschreiben und
-- macht den Arc dann als eigenen Arc mit genau diesen Regeln. Im Tagesstatus steht zusätzlich,
-- welche Crew-Regeln erledigt sind – so vergleicht sich die Crew Regel für Regel.

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
  with check (public.is_crew_owner(crew_id) and created_by = (select auth.uid()));

drop policy if exists "crew arcs change" on public.crew_arcs;
create policy "crew arcs change" on public.crew_arcs
  for update to authenticated
  using (public.is_crew_owner(crew_id) and not public.crew_arc_others_signed(id))
  with check (public.is_crew_owner(crew_id));

drop policy if exists "crew arcs delete" on public.crew_arcs;
create policy "crew arcs delete" on public.crew_arcs
  for delete to authenticated using (public.is_crew_owner(crew_id));

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
