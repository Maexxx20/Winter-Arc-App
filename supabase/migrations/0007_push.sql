-- Nordwand – Push-Mitteilungen (Reaktionen und neue Crew-Mitglieder)
-- Nach 0006_photos.sql im SQL Editor ausführen. Mehrfach ausführbar.
--
-- Die Datenbank schickt die Mitteilung selbst über den Expo-Push-Dienst (Erweiterung pg_net).
-- Ein eigener Server ist nicht nötig. Schlägt das Senden fehl, wird die Reaktion trotzdem gespeichert.

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net nicht verfügbar – Push bleibt aus (%).', sqlerrm;
end;
$$;

-- ---------- Geräte-Tokens ----------

create table if not exists public.push_tokens (
  token text primary key check (token like 'ExponentPushToken[%' or token like 'ExpoPushToken[%'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "own push tokens" on public.push_tokens;
create policy "own push tokens" on public.push_tokens
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Ein Gerät gehört immer nur einem Konto: Wer sich auf einem Handy neu anmeldet, übernimmt das Token.
create or replace function public.claim_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, (select auth.uid()), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;
revoke all on function public.claim_push_token(text, text) from public, anon;
grant execute on function public.claim_push_token(text, text) to authenticated;

-- Pro Absender, Empfänger, Crew, Art und Kalendertag höchstens eine Mitteilung.
create table if not exists public.push_log (
  crew_id uuid not null references public.crews (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reaction', 'join')),
  day date not null default current_date,
  primary key (crew_id, from_user, to_user, kind, day)
);
alter table public.push_log enable row level security; -- keine Policies: nur die Datenbank selbst schreibt

-- true, wenn heute noch keine solche Mitteilung verschickt wurde (und merkt sie sich).
create or replace function public.push_allowed(p_crew uuid, p_from uuid, p_to uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  insert into public.push_log (crew_id, from_user, to_user, kind)
  values (p_crew, p_from, p_to, p_kind)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;
revoke all on function public.push_allowed(uuid, uuid, uuid, text) from public, anon, authenticated;

-- ---------- Senden ----------

create or replace function public.send_push(p_user uuid, p_title text, p_body text, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', p_title,
    'body', p_body,
    'sound', 'default',
    'channelId', 'crew',
    'data', jsonb_build_object('url', p_url)
  ))
  into v_messages
  from public.push_tokens t
  where t.user_id = p_user;

  if v_messages is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
exception when others then
  -- Push ist nett, aber nie wichtiger als die eigentliche Aktion.
  raise notice 'Push nicht gesendet: %', sqlerrm;
end;
$$;
revoke all on function public.send_push(uuid, text, text, text) from public, anon, authenticated;

-- Anzeigename in einer Crew (Profilname, sonst Name in der Crew)
create or replace function public.crew_display_name(p_crew uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(p.name), ''), m.display_name, 'Jemand')
  from public.crew_members m
  left join public.profiles p on p.id = m.user_id
  where m.crew_id = p_crew and m.user_id = p_user;
$$;
revoke all on function public.crew_display_name(uuid, uuid) from public, anon, authenticated;

-- Reaktion: höchstens eine Mitteilung pro Person, Empfänger und Tag (auch nach Zurücknehmen und neu Reagieren).
create or replace function public.notify_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew text;
begin
  if not public.push_allowed(new.crew_id, new.from_user, new.to_user, 'reaction') then
    return null;
  end if;
  select name into v_crew from public.crews where id = new.crew_id;
  perform public.send_push(
    new.to_user,
    coalesce(v_crew, 'Nordwand'),
    public.crew_display_name(new.crew_id, new.from_user) || ' hat dir ' || new.emoji || ' geschickt',
    '/crew/' || new.crew_id
  );
  return null;
end;
$$;

drop trigger if exists notify_reaction on public.reactions;
create trigger notify_reaction after insert on public.reactions
  for each row execute function public.notify_reaction();

-- Neues Mitglied: alle anderen in der Crew bekommen Bescheid.
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
    if public.push_allowed(new.crew_id, new.user_id, v_other, 'join') then
      perform public.send_push(v_other, coalesce(v_crew, 'Nordwand'), v_name || ' ist der Crew beigetreten', '/crew/' || new.crew_id);
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists notify_join on public.crew_members;
create trigger notify_join after insert on public.crew_members
  for each row execute function public.notify_join();
