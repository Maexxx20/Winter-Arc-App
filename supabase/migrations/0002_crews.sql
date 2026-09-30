-- Nordwand – Crews (Phase 2)
-- Nach 0001_init.sql im SQL Editor ausführen.
--
-- Eine Crew ist eine kleine Gruppe (max. 20), in der jede Person ihren eigenen Arc
-- macht. Geteilt wird nur eine Zusammenfassung pro Tag (daily_status) – nie
-- Regeln, Notizen oder Fotos.

-- ---------- Tabellen ----------

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique,
  -- Besitzer; wird bei Kontolöschung leer, die Crew bleibt für die anderen bestehen.
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index if not exists crew_members_user on public.crew_members (user_id);

-- Tages-Zusammenfassung, die Crew-Mitglieder sehen dürfen.
create table if not exists public.daily_status (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  status text not null check (status in ('done', 'partial', 'missed', 'shielded', 'open', 'neutral')),
  done smallint not null default 0,
  total smallint not null default 0,
  day_number smallint not null default 0,
  total_days smallint not null default 0,
  streak smallint not null default 0,
  best_streak smallint not null default 0,
  rate smallint not null default 0 check (rate between 0 and 100), -- Quote in %
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  from_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  date date not null,
  emoji text not null check (emoji in ('🔥', '💪', '👏', '❄️', '🫡')),
  created_at timestamptz not null default now(),
  unique (crew_id, from_user, to_user, date, emoji)
);
create index if not exists reactions_crew_date on public.reactions (crew_id, date);

-- ---------- Hilfsfunktionen (security definer, damit RLS nicht rekursiv wird) ----------

create or replace function public.is_crew_member(p_crew uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crew_members m where m.crew_id = p_crew and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_crew_mate(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = (select auth.uid()) or exists (
    select 1
    from public.crew_members a
    join public.crew_members b on a.crew_id = b.crew_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- ---------- Row Level Security ----------

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.daily_status enable row level security;
alter table public.reactions enable row level security;

-- Crews: lesen nur als Mitglied; umbenennen nur als Besitzer. Anlegen/Beitreten über Funktionen.
drop policy if exists "crews read" on public.crews;
create policy "crews read" on public.crews
  for select to authenticated using (public.is_crew_member(id));
drop policy if exists "crews rename" on public.crews;
create policy "crews rename" on public.crews
  for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

-- Mitglieder: sehen, wer in den eigenen Crews ist; eigenen Anzeigenamen ändern; selbst austreten.
drop policy if exists "members read" on public.crew_members;
create policy "members read" on public.crew_members
  for select to authenticated using (public.is_crew_member(crew_id));
drop policy if exists "members update self" on public.crew_members;
create policy "members update self" on public.crew_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "members leave" on public.crew_members;
create policy "members leave" on public.crew_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- Tagesstatus: schreiben nur für sich selbst, lesen für sich und Crew-Mitglieder.
drop policy if exists "status read" on public.daily_status;
create policy "status read" on public.daily_status
  for select to authenticated using (public.is_crew_mate(user_id));
drop policy if exists "status write" on public.daily_status;
create policy "status write" on public.daily_status
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "status update" on public.daily_status;
create policy "status update" on public.daily_status
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Reaktionen: in eigenen Crews lesen; nur an Crew-Mitglieder und im eigenen Namen senden; eigene zurücknehmen.
drop policy if exists "reactions read" on public.reactions;
create policy "reactions read" on public.reactions
  for select to authenticated using (public.is_crew_member(crew_id));
drop policy if exists "reactions send" on public.reactions;
create policy "reactions send" on public.reactions
  for insert to authenticated with check (
    from_user = (select auth.uid())
    and to_user <> from_user
    and public.is_crew_member(crew_id)
    and exists (select 1 from public.crew_members m where m.crew_id = reactions.crew_id and m.user_id = reactions.to_user)
  );
drop policy if exists "reactions undo" on public.reactions;
create policy "reactions undo" on public.reactions
  for delete to authenticated using (from_user = (select auth.uid()));

-- ---------- Funktionen: Crew anlegen, beitreten, verlassen ----------

create or replace function public.create_crew(p_name text, p_display_name text)
returns public.crews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew public.crews;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- ohne 0/O, 1/I
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if (select count(*) from public.crew_members where user_id = (select auth.uid())) >= 5 then
    raise exception 'too_many_crews';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.crews where invite_code = v_code);
  end loop;

  insert into public.crews (name, invite_code, created_by)
  values (trim(p_name), v_code, (select auth.uid()))
  returning * into v_crew;

  insert into public.crew_members (crew_id, user_id, display_name, role)
  values (v_crew.id, (select auth.uid()), trim(p_display_name), 'owner');

  return v_crew;
end;
$$;

create or replace function public.join_crew(p_code text, p_display_name text)
returns public.crews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew public.crews;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_crew from public.crews where invite_code = upper(trim(p_code));
  if v_crew.id is null then
    raise exception 'crew_not_found';
  end if;
  if exists (select 1 from public.crew_members where crew_id = v_crew.id and user_id = (select auth.uid())) then
    return v_crew; -- schon drin
  end if;
  if (select count(*) from public.crew_members where crew_id = v_crew.id) >= 20 then
    raise exception 'crew_full';
  end if;
  if (select count(*) from public.crew_members where user_id = (select auth.uid())) >= 5 then
    raise exception 'too_many_crews';
  end if;
  insert into public.crew_members (crew_id, user_id, display_name)
  values (v_crew.id, (select auth.uid()), trim(p_display_name));
  return v_crew;
end;
$$;

-- Austreten; verlässt die letzte Person die Crew, wird sie gelöscht.
-- Verlässt der Besitzer die Crew, übernimmt das am längsten dabei gewesene Mitglied.
create or replace function public.leave_crew(p_crew uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next uuid;
begin
  delete from public.crew_members where crew_id = p_crew and user_id = (select auth.uid());
  if not exists (select 1 from public.crew_members where crew_id = p_crew) then
    delete from public.crews where id = p_crew;
    return;
  end if;
  if coalesce((select created_by from public.crews where id = p_crew), (select auth.uid())) = (select auth.uid()) then
    select user_id into v_next from public.crew_members where crew_id = p_crew order by joined_at limit 1;
    update public.crews set created_by = v_next where id = p_crew;
    update public.crew_members set role = 'owner' where crew_id = p_crew and user_id = v_next;
  end if;
end;
$$;

revoke all on function public.create_crew(text, text) from public, anon;
revoke all on function public.join_crew(text, text) from public, anon;
revoke all on function public.leave_crew(uuid) from public, anon;
revoke all on function public.is_crew_member(uuid) from public, anon;
revoke all on function public.is_crew_mate(uuid) from public, anon;
grant execute on function public.create_crew(text, text) to authenticated;
grant execute on function public.join_crew(text, text) to authenticated;
grant execute on function public.leave_crew(uuid) to authenticated;
grant execute on function public.is_crew_member(uuid) to authenticated;
grant execute on function public.is_crew_mate(uuid) to authenticated;
