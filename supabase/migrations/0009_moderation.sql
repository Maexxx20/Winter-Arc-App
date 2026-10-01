-- Nordwand – Crews moderieren: Mitglieder entfernen, Personen blockieren, Einladungscode erneuern
-- Nach 0008_strava.sql im SQL Editor ausführen. Mehrfach ausführbar.
--
-- Blockieren wirkt in beide Richtungen: Die zwei Personen sehen weder Profil noch Tagesstatus
-- der anderen, können sich keine Reaktionen schicken und bekommen keine Mitteilungen voneinander.
-- Entfernte Mitglieder kommen mit dem alten Code nicht wieder in die Crew.

-- ---------- Blockieren ----------

create table if not exists public.user_blocks (
  blocker uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  -- Name zum Zeitpunkt des Blockierens (das Profil ist danach nicht mehr lesbar)
  name text not null default '' check (char_length(name) <= 40),
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

alter table public.user_blocks enable row level security;
drop policy if exists "own blocks" on public.user_blocks;
create policy "own blocks" on public.user_blocks
  for all to authenticated
  using (blocker = (select auth.uid()))
  with check (blocker = (select auth.uid()));

-- true, wenn zwischen mir und p_other eine Blockierung besteht (egal wer wen blockiert hat).
create or replace function public.is_blocked_pair(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker = (select auth.uid()) and b.blocked = p_other)
       or (b.blocker = p_other and b.blocked = (select auth.uid()))
  );
$$;

-- Dasselbe zwischen zwei beliebigen Personen (nur für die Datenbank selbst, z. B. Mitteilungen).
create or replace function public.blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker = p_a and b.blocked = p_b) or (b.blocker = p_b and b.blocked = p_a)
  );
$$;

revoke all on function public.is_blocked_pair(uuid) from public, anon;
grant execute on function public.is_blocked_pair(uuid) to authenticated;
revoke all on function public.blocked_between(uuid, uuid) from public, anon, authenticated;

-- Crew-Kolleg:in = gemeinsame Crew und keine Blockierung. Steuert Profil, Profilbild und Tagesstatus.
create or replace function public.is_crew_mate(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = (select auth.uid()) or (
    exists (
      select 1
      from public.crew_members a
      join public.crew_members b on a.crew_id = b.crew_id
      where a.user_id = (select auth.uid()) and b.user_id = p_user
    )
    and not exists (
      select 1 from public.user_blocks x
      where (x.blocker = (select auth.uid()) and x.blocked = p_user)
         or (x.blocker = p_user and x.blocked = (select auth.uid()))
    )
  );
$$;

-- Reaktionen: nichts von oder an blockierte Personen
drop policy if exists "reactions read" on public.reactions;
create policy "reactions read" on public.reactions
  for select to authenticated using (
    public.is_crew_member(crew_id)
    and not public.is_blocked_pair(from_user)
    and not public.is_blocked_pair(to_user)
  );
drop policy if exists "reactions send" on public.reactions;
create policy "reactions send" on public.reactions
  for insert to authenticated with check (
    from_user = (select auth.uid())
    and to_user <> from_user
    and public.is_crew_member(crew_id)
    and exists (select 1 from public.crew_members m where m.crew_id = reactions.crew_id and m.user_id = reactions.to_user)
    and not public.is_blocked_pair(to_user)
  );

-- Beitritts-Mitteilung nicht an Personen, die sich blockiert haben
create or replace function public.notify_join()
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
  select name into v_crew from public.crews where id = new.crew_id;
  v_name := public.crew_display_name(new.crew_id, new.user_id);
  for v_other in select user_id from public.crew_members where crew_id = new.crew_id and user_id <> new.user_id loop
    if not public.blocked_between(new.user_id, v_other) and public.push_allowed(new.crew_id, new.user_id, v_other, 'join') then
      perform public.send_push(v_other, coalesce(v_crew, 'Nordwand'), v_name || ' ist der Crew beigetreten', '/crew/' || new.crew_id);
    end if;
  end loop;
  return null;
end;
$$;

-- ---------- Mitglieder entfernen ----------

create table if not exists public.crew_bans (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '',
  banned_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
alter table public.crew_bans enable row level security; -- keine Policies: nur über die Funktionen unten
revoke all on public.crew_bans from anon, authenticated;

create or replace function public.require_crew_owner(p_crew uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.crews where id = p_crew and created_by = (select auth.uid())) then
    raise exception 'not_owner';
  end if;
end;
$$;
revoke all on function public.require_crew_owner(uuid) from public, anon, authenticated;

-- Nur der Besitzer: Mitglied entfernen. Die Person kann danach nicht mehr mit dem Code beitreten.
create or replace function public.remove_member(p_crew uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform public.require_crew_owner(p_crew);
  if p_user = (select auth.uid()) then
    raise exception 'cannot_remove_self';
  end if;
  select display_name into v_name from public.crew_members where crew_id = p_crew and user_id = p_user;
  if v_name is null then
    raise exception 'not_member';
  end if;
  insert into public.crew_bans (crew_id, user_id, display_name)
  values (p_crew, p_user, coalesce(public.crew_display_name(p_crew, p_user), v_name))
  on conflict (crew_id, user_id) do update set banned_at = now(), display_name = excluded.display_name;
  delete from public.crew_members where crew_id = p_crew and user_id = p_user;
end;
$$;

-- Nur der Besitzer: entfernte Personen sehen und wieder zulassen
create or replace function public.crew_removed(p_crew uuid)
returns table (user_id uuid, display_name text, banned_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_crew_owner(p_crew);
  return query select b.user_id, b.display_name, b.banned_at from public.crew_bans b where b.crew_id = p_crew order by b.banned_at desc;
end;
$$;

create or replace function public.unban_member(p_crew uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_crew_owner(p_crew);
  delete from public.crew_bans where crew_id = p_crew and user_id = p_user;
end;
$$;

-- Nur der Besitzer: neuen Einladungscode erzeugen (der alte gilt dann nicht mehr)
create or replace function public.renew_invite_code(p_crew uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  perform public.require_crew_owner(p_crew);
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.crews where invite_code = v_code);
  end loop;
  update public.crews set invite_code = v_code where id = p_crew;
  return v_code;
end;
$$;

-- Beitreten wie bisher, aber nicht nach dem Entfernen
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
  if exists (select 1 from public.crew_bans where crew_id = v_crew.id and user_id = (select auth.uid())) then
    raise exception 'removed_from_crew';
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

revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.crew_removed(uuid) from public, anon;
revoke all on function public.unban_member(uuid, uuid) from public, anon;
revoke all on function public.renew_invite_code(uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.crew_removed(uuid) to authenticated;
grant execute on function public.unban_member(uuid, uuid) to authenticated;
grant execute on function public.renew_invite_code(uuid) to authenticated;
