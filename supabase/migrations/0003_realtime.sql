-- Nordwand – Live-Updates für Crews (Phase 3)
-- Nach 0002_crews.sql ausführen. Schaltet Supabase Realtime für Reaktionen und
-- Tagesstatus ein. Die Zugriffsregeln (RLS) gelten auch für Live-Updates:
-- Man bekommt nur, was man auch lesen darf.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reactions'
  ) then
    alter publication supabase_realtime add table public.reactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_status'
  ) then
    alter publication supabase_realtime add table public.daily_status;
  end if;
end;
$$;
