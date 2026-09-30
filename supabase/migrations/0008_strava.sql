-- Nordwand – Strava-Verbindung
-- Nach 0007_push.sql im SQL Editor ausführen. Mehrfach ausführbar.
--
-- Die Zugangsschlüssel für Strava liegen nur hier und nur die Edge Function «strava»
-- (mit dem Service-Schlüssel) liest sie. Die App selbst sieht sie nie.

create table if not exists public.strava_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint not null,
  athlete_name text not null default '',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- RLS an, aber keine Policies: Weder die App noch andere Nutzer können die Tabelle lesen.
alter table public.strava_connections enable row level security;
revoke all on public.strava_connections from anon, authenticated;
