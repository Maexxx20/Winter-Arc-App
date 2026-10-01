-- Nordwand – Mitteilungen in der Sprache des Geräts und «Anstupsen»
-- Nach 0009_moderation.sql im SQL Editor ausführen. Mehrfach ausführbar.

-- ---------- Sprache pro Gerät ----------

alter table public.push_tokens add column if not exists lang text not null default 'de';
alter table public.push_tokens drop constraint if exists push_tokens_lang_check;
alter table public.push_tokens add constraint push_tokens_lang_check check (lang in ('de', 'en', 'fr', 'it'));

create or replace function public.claim_push_token(p_token text, p_platform text, p_lang text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.push_tokens (token, user_id, platform, lang, updated_at)
  values (p_token, (select auth.uid()), p_platform, case when p_lang in ('de', 'en', 'fr', 'it') then p_lang else 'de' end, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, lang = excluded.lang, updated_at = now();
end;
$$;
revoke all on function public.claim_push_token(text, text, text) from public, anon;
grant execute on function public.claim_push_token(text, text, text) to authenticated;

-- Texte der Mitteilungen. {a} = Name, {b} = Emoji bzw. Titel.
create or replace function public.push_text(p_lang text, p_key text, p_a text, p_b text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(
    case p_key
      when 'reaction' then case p_lang
        when 'en' then '{a} sent you {b}'
        when 'fr' then '{a} t''a envoyé {b}'
        when 'it' then '{a} ti ha inviato {b}'
        else '{a} hat dir {b} geschickt' end
      when 'join' then case p_lang
        when 'en' then '{a} joined the crew'
        when 'fr' then 'Nouveau dans le crew : {a}'
        when 'it' then 'Nuovo nella crew: {a}'
        else '{a} ist der Crew beigetreten' end
      when 'nudge' then case p_lang
        when 'en' then '{a} is nudging you – something is still open today.'
        when 'fr' then '{a} te fait signe : il te reste encore quelque chose aujourd''hui.'
        when 'it' then '{a} ti dà una spinta: oggi hai ancora qualcosa da fare.'
        else '{a} stupst dich an – heute ist noch etwas offen.' end
      when 'crew_arc' then case p_lang
        when 'en' then '{a} started the crew arc "{b}". Will you sign too?'
        when 'fr' then '{a} a lancé l''arc du crew « {b} ». Tu signes aussi ?'
        when 'it' then '{a} ha lanciato l''arc della crew «{b}». Firmi anche tu?'
        else '{a} hat den Crew-Arc «{b}» gestartet. Unterschreibst du mit?' end
      else coalesce(p_b, '')
    end,
    '{a}', coalesce(p_a, '')), '{b}', coalesce(p_b, ''));
$$;

-- Senden mit Text pro Gerät in dessen Sprache
create or replace function public.send_push_i18n(p_user uuid, p_title text, p_key text, p_a text, p_b text, p_url text)
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
    'body', public.push_text(t.lang, p_key, p_a, p_b),
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
  raise notice 'Push nicht gesendet: %', sqlerrm;
end;
$$;
revoke all on function public.send_push_i18n(uuid, text, text, text, text, text) from public, anon, authenticated;

-- Bestehende Mitteilungen auf die Sprache umstellen
create or replace function public.notify_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crew text;
begin
  if public.blocked_between(new.from_user, new.to_user)
     or not public.push_allowed(new.crew_id, new.from_user, new.to_user, 'reaction') then
    return null;
  end if;
  select name into v_crew from public.crews where id = new.crew_id;
  perform public.send_push_i18n(
    new.to_user, coalesce(v_crew, 'Nordwand'), 'reaction',
    public.crew_display_name(new.crew_id, new.from_user), new.emoji, '/crew/' || new.crew_id
  );
  return null;
end;
$$;

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
      perform public.send_push_i18n(v_other, coalesce(v_crew, 'Nordwand'), 'join', v_name, null, '/crew/' || new.crew_id);
    end if;
  end loop;
  return null;
end;
$$;

-- ---------- Anstupsen ----------

alter table public.push_log drop constraint if exists push_log_kind_check;
alter table public.push_log add constraint push_log_kind_check check (kind in ('reaction', 'join', 'nudge', 'crew_arc'));

-- Ein Crew-Mitglied anstupsen, dessen Tag noch offen ist. Pro Person, Empfänger und Tag einmal.
-- Antwort: 'sent' oder 'already' (heute schon angestupst).
create or replace function public.nudge(p_crew uuid, p_user uuid, p_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_status text;
  v_crew text;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_user = v_me then
    raise exception 'cannot_nudge_self';
  end if;
  if not exists (select 1 from public.crew_members where crew_id = p_crew and user_id = v_me)
     or not exists (select 1 from public.crew_members where crew_id = p_crew and user_id = p_user) then
    raise exception 'not_member';
  end if;
  if public.blocked_between(v_me, p_user) then
    raise exception 'blocked';
  end if;
  -- Nur, wenn der Tag noch nicht gehalten ist (Datum ± 1 Tag, wegen Zeitzonen und Tageswechsel)
  if abs(p_date - (now() at time zone 'Europe/Zurich')::date) > 1 then
    raise exception 'bad_date';
  end if;
  select status into v_status from public.daily_status where user_id = p_user and date = p_date;
  if v_status in ('done', 'shielded', 'neutral') then
    raise exception 'already_done';
  end if;
  if not public.push_allowed(p_crew, v_me, p_user, 'nudge') then
    return 'already';
  end if;
  select name into v_crew from public.crews where id = p_crew;
  perform public.send_push_i18n(p_user, coalesce(v_crew, 'Nordwand'), 'nudge', public.crew_display_name(p_crew, v_me), null, '/');
  return 'sent';
end;
$$;
revoke all on function public.nudge(uuid, uuid, date) from public, anon;
grant execute on function public.nudge(uuid, uuid, date) to authenticated;

-- Wen habe ich heute schon angestupst? (für die Anzeige in der App)
create or replace function public.my_nudges_today(p_crew uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.to_user from public.push_log l
  where l.crew_id = p_crew and l.from_user = (select auth.uid()) and l.kind = 'nudge'
    and l.day = (now() at time zone 'Europe/Zurich')::date;
$$;
revoke all on function public.my_nudges_today(uuid) from public, anon;
grant execute on function public.my_nudges_today(uuid) to authenticated;
