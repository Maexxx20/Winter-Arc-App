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
`);
for (const f of fs.readdirSync(dir).sort()) { await db.exec(fs.readFileSync(dir + f, 'utf8')); console.log('ok', f); }
await db.exec(`grant all on all tables in schema public to authenticated;`);

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

// Reaktionen
r = await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${A}', '2026-10-05', '🔥') returning id`, [crew.id]); check('B reagiert auf A', r.length === 1, r);
r = await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${B}', '2026-10-05', '🔥')`, [crew.id]); check('keine Reaktion an sich selbst', !!r.error, r);
r = await as(C, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${A}', '2026-10-05', '🔥')`, [crew.id]); check('C darf nicht reagieren', !!r.error, r);
r = await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${C}', '2026-10-05', '🔥')`, [crew.id]); check('nicht an Nicht-Mitglied', !!r.error, r);
r = await as(B, `insert into reactions (crew_id, to_user, date, emoji) values ($1, '${A}', '2026-10-05', '💩')`, [crew.id]); check('nur erlaubte Emojis', !!r.error, r);
r = await as(A, `select emoji from reactions`); check('A sieht Reaktion', r.length === 1, r);
r = await as(A, `delete from reactions returning id`); check('A kann fremde Reaktion nicht löschen', Array.isArray(r) && r.length === 0, r);

// Besitzerwechsel und Austritt
await as(C, `select * from join_crew($1, 'Cem')`, [crew.invite_code]);
r = await as(A, `select leave_crew($1)`, [crew.id]); check('A tritt aus', !r.error, r);
r = await as(B, `select user_id, role from crew_members order by joined_at`); check('B wird Besitzer', r[0]?.user_id === B && r[0]?.role === 'owner' && r.length === 2, r);
r = await as(B, `select created_by from crews`); check('created_by = B', r[0]?.created_by === B, r);
r = await as(B, `select * from daily_status where user_id = '${A}'`); check('B sieht A nach Austritt nicht mehr', r.length === 0, r);
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

// Limit: max 5 Crews
for (let i = 0; i < 5; i++) await as(C, `select * from create_crew('C${i}', 'Cem')`);
r = await as(C, `select * from create_crew('C6', 'Cem')`); check('max. 5 Crews', r.error?.includes('too_many_crews'), r);

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
