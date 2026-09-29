-- Nordwand – Datenbankschema (Supabase / Postgres)
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.
--
-- Prinzip: Die App ist offline-first. Jede Zeile trägt `updated_at` (vom Gerät)
-- und `server_updated_at` (von der Datenbank). Beim Hochladen gewinnt die neuere
-- Version (updated_at), beim Herunterladen holt die App alles, was seit dem
-- letzten Abgleich geändert wurde (server_updated_at).

-- ---------- Tabellen ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create table if not exists public.arcs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,                 -- komplettes Arc-Objekt der App
  status text not null default 'active',
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);
create index if not exists arcs_user_sync on public.arcs (user_id, server_updated_at);

create table if not exists public.day_entries (
  arc_id uuid not null references public.arcs (id) on delete cascade,
  date date not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "values" jsonb not null default '{}'::jsonb,
  note text,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (arc_id, date)
);
create index if not exists day_entries_user_sync on public.day_entries (user_id, server_updated_at);

create table if not exists public.week_reviews (
  arc_id uuid not null references public.arcs (id) on delete cascade,
  week date not null,                  -- Montag der Woche
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (arc_id, week)
);
create index if not exists week_reviews_user_sync on public.week_reviews (user_id, server_updated_at);

-- ---------- Neuere Version gewinnt ----------

create or replace function public.keep_newer()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old; -- ältere Version vom Gerät verwerfen
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

drop trigger if exists keep_newer on public.profiles;
create trigger keep_newer before insert or update on public.profiles for each row execute function public.keep_newer();
drop trigger if exists keep_newer on public.arcs;
create trigger keep_newer before insert or update on public.arcs for each row execute function public.keep_newer();
drop trigger if exists keep_newer on public.day_entries;
create trigger keep_newer before insert or update on public.day_entries for each row execute function public.keep_newer();
drop trigger if exists keep_newer on public.week_reviews;
create trigger keep_newer before insert or update on public.week_reviews for each row execute function public.keep_newer();

-- ---------- Row Level Security: jeder sieht nur seine eigenen Daten ----------

alter table public.profiles enable row level security;
alter table public.arcs enable row level security;
alter table public.day_entries enable row level security;
alter table public.week_reviews enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "own arcs" on public.arcs;
create policy "own arcs" on public.arcs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own entries" on public.day_entries;
create policy "own entries" on public.day_entries
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own reviews" on public.week_reviews;
create policy "own reviews" on public.week_reviews
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- Account löschen (von Apple verlangt) ----------

create or replace function public.delete_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
