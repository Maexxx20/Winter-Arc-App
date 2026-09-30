// Testet Schema und Row Level Security gegen ein eingebettetes Postgres (PGlite).
// Start: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const dir = new URL('../migrations/', import.meta.url).pathname;
const db = new PGlite();
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Nachbau des Supabase-Speichers (nur was die Migrationen brauchen)
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner_id text default auth.uid()::text, unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
-- Nachbau von pg_net: merkt sich die Aufrufe
create schema net;
create table net.calls (id serial primary key, url text, body jsonb);
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as $$ insert into net.calls (url, body) values (url, body) returning id::bigint $$;
`);
for (const f of fs.readdirSync(dir).sort()) { await db.exec(fs.readFileSync(dir + f, 'utf8')); console.log('ok', f); }
// Alle Migrationen müssen mehrfach ausführbar sein
for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(dir + f, 'utf8'));
console.log('ok zweiter Durchlauf');
{ const r = await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`); if (r.rows.map((x) => x.tablename).join() !== 'crew_challenges,daily_status,reactions') { console.log('FAIL realtime', r.rows); process.exit(1); } }
await db.exec(`grant all on all tables in schema public to authenticated; grant all on storage.objects to authenticated;`);
// Wie in Supabase: Tabellen ohne Policies bleiben trotz Grants zu (RLS); zusätzlich den Revoke aus 0008 nachstellen
await db.exec(`revoke all on public.strava_connections from anon, authenticated; revoke all on public.strava_oauth_states from anon, authenticated;`);
{ const r = await db.query(`select public, file_size_limit from storage.buckets where id = 'avatars'`); if (r.rows[0]?.public !== false) { console.log('FAIL bucket', r.rows); process.exit(1); } }

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users values ('${A}'),('${B}'),('${C}')`);
const as = async (u, sql, params) => {
  await db.exec(`reset role; set request.jwt.claim.sub = '${u}'; set role authenticated;`);
  try { return (await db.query(sql, params)).rows; } catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
};
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; } else { fail++; console.log('FAIL', name, JSON.stringify(extra)); } };

// 0001: Arcs privat + neuere Version gewinnt
await as(A, `insert into arcs (id, data, status, updated_at) values ('11111111-1111-1111-1111-111111111111', '{"title":"neu"}', 'active', '2026-10-05')`);
await as(A, `update arcs set data = '{"title":"alt"}', updated_at = '2026-10-01' where id = '11111111-1111-1111-1111-111111111111'`);
let r = await as(A, `select data->>'title' t from arcs`);
check('ältere Version ignoriert', r[0]?.t === 'neu', r);
r = await as(B, `select * from arcs`);
check('B sieht Arcs von A nicht', r.length === 0, r);
r = await as(B, `insert into arcs (id, user_id, data, status, updated_at) values (gen_random_uuid(), '${A}', '{}', 'active', now())`);
check('B kann nicht für A schreiben', !!r.error, r);

// Crews
r = await as(A, `select * from create_crew('Eishockey', 'Mäx')`);
const crew = r[0]; check('Crew erstellt', crew?.invite_code?.length === 6, r);
r = await as(B, `select * from crews`); check('B sieht Crew vor Beitritt nicht', r.length === 0, r);
r = await as(B, `select * from join_crew($1, 'Ben')`, [crew.invite_code.toLowerCase()]); check('B tritt bei (Kleinschreibung)', r[0]?.id === crew.id, r);
r = await as(B, `select * from join_crew($1, 'Ben')`, [crew.invite_code]); check('doppelt beitreten ok', r[0]?.id === crew.id, r);
r = await as(C, `select * from join_crew('ZZZZZZ', 'Cem')`); check('falscher Code', r.error?.includes('crew_not_found'), r);
r = await as(B, `select display_name, role from crew_members order by joined_at`); check('B sieht beide Mitglieder', r.length === 2 && r[0].role === 'owner', r);
r = await as(C, `select * from crew_members`); check('C sieht keine Mitglieder', r.length === 0, r);

// Status
await as(A, `insert into daily_status (date, status, done, total, streak) values ('2026-10-05', 'done', 4, 4, 5)`);
r = await as(B, `select * from daily_status where user_id = '${A}'`); check('B sieht Status von A', r.length === 1, r);
r = await as(C, `select * from daily_status where user_id = '${A}'`); check('C sieht Status von A nicht', r.length === 0, r);
r = await as(B, `update daily_status set streak = 99 where user_id = '${A}' returning *`); check('B kann Status von A nicht ändern', Array.isArray(r) && r.length === 0, r);
r = await as(A, `insert into daily_status (date, status) values ('2026-10-05', 'partial') on conflict (user_id, date) do update set status = excluded.status returning status`);
check('Upsert eigener Status', r[0]?.status === 'partial', r);
r = await as(B, `select * from daily_status where user_id = '${A}' and date = '2026-10-05'`);

// Profile (0004): A und B sind in einer Crew, C nicht
r = await as(A, `insert into profiles (id, name, motto, instagram, avatar_path, updated_at) values ('${A}', 'Mäx', 'Kein Tag ohne Training', 'maexxx20', '${A}/1.jpg', now()) returning motto`);
check('A legt Profil an', r[0]?.motto === 'Kein Tag ohne Training', r);
r = await as(B, `select name, motto, instagram, avatar_path from profiles where id = '${A}'`); check('B sieht Profil von A', r[0]?.instagram === 'maexxx20', r);
r = await as(C, `select * from profiles where id = '${A}'`); check('C sieht Profil von A nicht', r.length === 0, r);
r = await as(B, `update profiles set motto = 'gehackt' where id = '${A}' returning id`); check('B kann Profil von A nicht ändern', Array.isArray(r) && r.length === 0, r);
r = await as(A, `update profiles set instagram = 'nicht gültig!' where id = '${A}'`); check('Instagram-Format geprüft', !!r.error, r);
r = await as(A, `update profiles set motto = repeat('x', 81) where id = '${A}'`); check('Motto max. 80 Zeichen', !!r.error, r);
r = await as(A, `update profiles set avatar_path = '${B}/1.jpg' where id = '${A}'`); check('fremder Bildpfad abgelehnt', !!r.error, r);
await as(A, `update profiles set name = 'Max K.', updated_at = now() + interval '1 second' where id = '${A}'`);
r = await as(B, `select display_name from crew_members where user_id = '${A}'`); check('Name gilt in der Crew', r[0]?.display_name === 'Max K.', r);
await as(A, `update crew_members set display_name = 'Nur hier' where user_id = '${A}'`);
await as(A, `update profiles set motto = 'Neu', updated_at = now() + interval '2 seconds' where id = '${A}'`);
r = await as(B, `select display_name from crew_members where user_id = '${A}'`); check('Motto-Änderung lässt Crew-Namen in Ruhe', r[0]?.display_name === 'Nur hier', r);
await as(A, `update profiles set motto = 'Alt', updated_at = now() - interval '1 day' where id = '${A}'`);
r = await as(A, `select motto from profiles where id = '${A}'`); check('ältere Profilversion ignoriert', r[0]?.motto === 'Neu', r);
r = await as(A, `insert into storage.objects (bucket_id, name) values ('avatars', '${A}/1.jpg') returning name`); check('A lädt eigenes Bild hoch', r.length === 1, r);
r = await as(A, `insert into storage.objects (bucket_id, name) values ('avatars', '${B}/x.jpg')`); check('A kann nicht in Ordner von B', !!r.error, r);
r = await as(A, `insert into storage.objects (bucket_id, name) values ('avatars', 'kein-ordner.jpg')`); check('Bild ohne Ordner abgelehnt', !!r.error, r);
r = await as(B, `select name from storage.objects where bucket_id = 'avatars'`); check('B sieht Bild von A', r.length === 1, r);
r = await as(C, `select name from storage.objects where bucket_id = 'avatars'`); check('C sieht Bild von A nicht', r.length === 0, r);
r = await as(B, `delete from storage.objects returning name`); check('B kann Bild von A nicht löschen', Array.isArray(r) && r.length === 0, r);
r = await as(A, `delete from storage.objects returning name`); check('A löscht eigenes Bild', r.length === 1, r);

// Challenges (0005): A = Besitzer, B = Mitglied, C = fremd
r = await as(B, `insert into crew_challenges (crew_id, week, kind, target) values ($1, '2026-10-05', 'crew_total', 10) returning target`, [crew.id]);
check('B startet Challenge', r[0]?.target === 10, r);
r = await as(C, `select * from crew_challenges`); check('C sieht Challenge nicht', r.length === 0, r);
r = await as(C, `insert into crew_challenges (crew_id, week, kind, target) values ($1, '2026-10-12', 'crew_total', 10)`, [crew.id]); check('C darf keine Challenge starten', !!r.error, r);
r = await as(B, `insert into crew_challenges (crew_id, week, kind, target) values ($1, '2026-10-06', 'crew_total', 10)`, [crew.id]); check('Woche muss Montag sein', !!r.error, r);
r = await as(B, `insert into crew_challenges (crew_id, week, kind, target, created_by) values ($1, '2026-10-19', 'everyone', 5, '${A}')`, [crew.id]); check('nicht im Namen anderer', !!r.error, r);
r = await as(A, `update crew_challenges set target = 12 returning target`); check('Besitzer darf ändern', r[0]?.target === 12, r);
r = await as(B, `update crew_challenges set target = 14 returning target`); check('Ersteller darf ändern', r[0]?.target === 14, r);
r = await as(A, `select week from crew_challenges`); check('A sieht Challenge', r.length === 1, r);
r = await as(A, `update profiles set badges = '[{"id":"streak_7","date":"2026-10-07"}]' where id = '${A}' returning badges`); check('Abzeichen speichern', r[0]?.badges?.[0]?.id === 'streak_7', r);
r = await as(B, `select badges from profiles where id = '${A}'`); check('B sieht Abzeichen von A', r[0]?.badges?.length === 1, r);
r = await as(A, `update profiles set badges = '{"x":1}' where id = '${A}'`); check('Abzeichen nur als Liste', !!r.error, r);

// Fotos (0006): nur Besitzer, auch nicht die Crew
r = await as(A, `insert into storage.objects (bucket_id, name) values ('photos', '${A}/p1.jpg') returning name`); check('A lädt Foto hoch', r.length === 1, r);
r = await as(A, `insert into storage.objects (bucket_id, name) values ('photos', '${B}/p1.jpg')`); check('A nicht in Foto-Ordner von B', !!r.error, r);
r = await as(B, `select name from storage.objects where bucket_id = 'photos'`); check('Crew sieht Fotos von A nicht', r.length === 0, r);
r = await as(A, `select name from storage.objects where bucket_id = 'photos'`); check('A sieht eigenes Foto', r.length === 1, r);
r = await as(B, `delete from storage.objects where bucket_id = 'photos' returning name`); check('B kann Foto von A nicht löschen', Array.isArray(r) && r.length === 0, r);
const ARC = '11111111-1111-1111-1111-111111111111';
r = await as(A, `insert into diary_photos (name, arc_id, date, updated_at) values ('photos/p1.jpg', '${ARC}', '2026-10-05', '2026-10-05T10:00:00Z') returning name`); check('Foto-Datensatz', r.length === 1, r);
r = await as(A, `insert into diary_photos (name, arc_id, date, updated_at) values ('../boese.jpg', '${ARC}', '2026-10-05', now())`); check('Dateiname geprüft', !!r.error, r);
r = await as(A, `update diary_photos set deleted = true, updated_at = '2026-10-04T10:00:00Z' returning deleted`); check('ältere Löschung ignoriert', r[0]?.deleted === false, r);
r = await as(A, `update diary_photos set deleted = true, updated_at = '2026-10-06T10:00:00Z' returning deleted`); check('neuere Löschmarke gilt', r[0]?.deleted === true, r);
r = await as(B, `select * from diary_photos`); check('Crew sieht Foto-Datensätze nicht', r.length === 0, r);
r = await as(B, `insert into diary_photos (user_id, name, arc_id, date, updated_at) values ('${A}', 'photos/x.jpg', '${ARC}', '2026-10-05', now())`); check('B schreibt nicht für A', !!r.error, r);

// Push (0007)
const TA = 'ExponentPushToken[aaaa]', TB = 'ExponentPushToken[bbbb]';
r = await as(A, `select claim_push_token($1, 'ios')`, [TA]); check('A registriert Token', !r.error, r);
r = await as(B, `select claim_push_token($1, 'ios')`, [TB]); check('B registriert Token', !r.error, r);
r = await as(B, `select * from push_tokens`); check('B sieht nur eigenes Token', r.length === 1 && r[0].token === TB, r);
r = await as(A, `insert into push_tokens (token, user_id) values ('ExponentPushToken[x]', '${B}')`); check('kein Token für andere', !!r.error, r);
r = await as(A, `insert into push_tokens (token) values ('kein-token')`); check('nur Expo-Tokens', !!r.error, r);
r = await as(A, `select send_push('${B}', 'x', 'y', '/')`); check('send_push nicht direkt aufrufbar', !!r.error, r);
await db.exec('delete from net.calls');

// Strava (0008): Tokens für niemanden lesbar ausser Service
await db.exec(`insert into strava_connections (user_id, athlete_id, access_token, refresh_token, expires_at) values ('${A}', 1, 'geheim', 'geheim2', now())`);
r = await as(A, `select * from strava_connections`); check('A sieht eigene Strava-Tokens nicht', !!r.error || r.length === 0, r);
r = await as(B, `select * from strava_connections`); check('B sieht Strava-Tokens nicht', !!r.error || r.length === 0, r);
r = await as(A, `insert into strava_connections (user_id, athlete_id, access_token, refresh_token, expires_at) values ('${A}', 2, 'x', 'y', now())`); check('App kann keine Tokens schreiben', !!r.error, r);
r = await as(A, `insert into strava_oauth_states (user_id, state) values ('${A}', 'x')`); check('App kann keinen OAuth-State setzen', !!r.error, r);
r = await as(A, `select * from strava_oauth_states`); check('App liest keinen OAuth-State', !!r.error || r.length === 0, r);

// Reaktionen
r = await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${A}', '2026-10-05', '🔥') returning id`, [crew.id]); check('B reagiert auf A', r.length === 1, r);
r = await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${B}', '2026-10-05', '🔥')`, [crew.id]); check('keine Reaktion an sich selbst', !!r.error, r);
r = await as(C, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${A}', '2026-10-05', '🔥')`, [crew.id]); check('C darf nicht reagieren', !!r.error, r);
r = await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${C}', '2026-10-05', '🔥')`, [crew.id]); check('nicht an Nicht-Mitglied', !!r.error, r);
r = await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${A}', '2026-10-05', '💩')`, [crew.id]); check('nur erlaubte Emojis', !!r.error, r);
r = await as(A, `select emoji from reactions`); check('A sieht Reaktion', r.length === 1, r);
{ const calls = (await db.query(`select body from net.calls`)).rows;
  check('Push an A bei Reaktion', calls.length === 1 && calls[0].body[0].to === TA && calls[0].body[0].body.includes('hat dir 🔥 geschickt') && calls[0].body[0].data.url === '/crew/' + crew.id, calls); }
await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${A}', '2026-10-05', '💪')`, [crew.id]);
{ const n = (await db.query(`select count(*)::int n from net.calls`)).rows[0].n; check('nur eine Mitteilung pro Tag und Person', n === 1, n); }
await as(B, `delete from reactions where from_user = '${B}'`);
await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${A}', '2026-10-05', '🔥')`, [crew.id]);
await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${A}', '2026-10-01', '🔥')`, [crew.id]);
{ const n = (await db.query(`select count(*)::int n from net.calls`)).rows[0].n; check('Zurücknehmen/anderes Datum löst keine weitere Mitteilung aus', n === 1, n); }
r = await as(B, `select * from push_log`); check('push_log nicht lesbar', Array.isArray(r) ? r.length === 0 : !!r.error, r);
r = await as(A, `delete from reactions returning id`); check('A kann fremde Reaktion nicht löschen', Array.isArray(r) && r.length === 0, r);

// Besitzerwechsel und Austritt
await db.exec('delete from net.calls');
await as(C, `select * from join_crew($1, 'Cem')`, [crew.invite_code]);
{ const calls = (await db.query(`select body from net.calls`)).rows.map((x) => x.body[0]);
  check('Beitritt meldet A und B', calls.length === 2 && calls.every((c) => c.body === 'Cem ist der Crew beigetreten'), calls); }
r = await as(C, `delete from crew_challenges returning week`); check('fremde Challenge nicht löschbar', Array.isArray(r) && r.length === 0, r);
r = await as(C, `select count(*)::int n from crew_challenges`); check('C sieht Challenge nach Beitritt', r[0]?.n === 1, r);
r = await as(A, `select leave_crew($1)`, [crew.id]); check('A tritt aus', !r.error, r);
r = await as(B, `select user_id, role from crew_members order by joined_at`); check('B wird Besitzer', r[0]?.user_id === B && r[0]?.role === 'owner' && r.length === 2, r);
r = await as(B, `select created_by from crews`); check('created_by = B', r[0]?.created_by === B, r);
r = await as(B, `select * from daily_status where user_id = '${A}'`); check('B sieht A nach Austritt nicht mehr', r.length === 0, r);
r = await as(B, `select * from profiles where id = '${A}'`); check('B sieht Profil von A nach Austritt nicht mehr', r.length === 0, r);
await as(B, `select leave_crew($1)`, [crew.id]);
await as(C, `select leave_crew($1)`, [crew.id]);
r = await db.query(`select count(*)::int n from crews`); check('leere Crew gelöscht', r.rows[0].n === 0, r.rows);

// Konto löschen (Besitzer) → Crew bleibt für andere
r = await as(A, `select * from create_crew('Zwei', 'Mäx')`); const c2 = r[0];
await as(B, `select * from join_crew($1, 'Ben')`, [c2.invite_code]);
r = await as(A, `select delete_account()`); check('delete_account', !r.error, r);
r = await as(B, `select name, created_by from crews`); check('Crew bleibt nach Kontolöschung', r.length === 1 && r[0].created_by === null, r);
r = await as(B, `select count(*)::int n from crew_members`); check('nur B übrig', r[0].n === 1, r);
r = await db.query(`select count(*)::int n from arcs`); check('Arcs von A gelöscht', r.rows[0].n === 0, r.rows);
r = await as(B, `select leave_crew($1)`, [c2.id]); check('B verlässt verwaiste Crew', !r.error, r);

// Push-Fehler dürfen Reaktionen nicht verhindern
await db.exec(`drop function net.http_post(text, jsonb, jsonb, jsonb, int)`);
r = await as(C, `select * from create_crew('Push kaputt', 'Cem')`); const c3 = r[0];
await as(B, `select * from join_crew($1, 'Ben')`, [c3.invite_code]);
r = await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${C}', '2026-10-06', '🔥') returning id`, [c3.id]); check('Reaktion trotz Push-Fehler', r.length === 1, r);
await as(B, `select leave_crew($1)`, [c3.id]); await as(C, `select leave_crew($1)`, [c3.id]);

// Limit: max 5 Crews
for (let i = 0; i < 5; i++) await as(C, `select * from create_crew('C${i}', 'Cem')`);
r = await as(C, `select * from create_crew('C6', 'Cem')`); check('max. 5 Crews', r.error?.includes('too_many_crews'), r);

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
