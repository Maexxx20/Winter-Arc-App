import { describe, expect, it } from 'vitest';

import { buildFeed, type Challenge, challengeProgress, challengeTitle, type CrewMember, defaultChallengeTarget, type StatusRow } from '../crew';

const m = (id: string, joined = ''): CrewMember => ({ crew_id: 'c', user_id: id, display_name: id, role: 'member', joined_at: joined });
const row = (user: string, date: string, status: StatusRow['status'] = 'done'): StatusRow => ({
  user_id: user, date, status, done: 1, total: 1, day_number: 1, total_days: 92, streak: 1, best_streak: 1, rate: 100,
});
const week = '2026-10-05'; // Montag
const days = (user: string, n: number, status: StatusRow['status'] = 'done') =>
  Array.from({ length: n }, (_, i) => row(user, `2026-10-${String(5 + i).padStart(2, '0')}`, status));

describe('Challenges', () => {
  it('Titel und Standardziel', () => {
    expect(challengeTitle({ kind: 'crew_total', target: 15 })).toBe('Zusammen 15 Tage halten');
    expect(challengeTitle({ kind: 'everyone', target: 5 })).toBe('Alle halten mind. 5 von 7 Tagen');
    expect(defaultChallengeTarget('crew_total', 3)).toBe(15);
    expect(defaultChallengeTarget('everyone', 3)).toBe(5);
  });

  it('zusammen: Summe der gehaltenen Tage, geschafft am richtigen Tag', () => {
    const c: Challenge = { crew_id: 'c', week, kind: 'crew_total', target: 6, created_by: 'a' };
    const rows = [...days('a', 3), ...days('b', 3), row('b', '2026-10-04')]; // Vorwoche zählt nicht
    const p = challengeProgress(c, [m('a'), m('b')], rows, '2026-10-08');
    expect(p).toMatchObject({ value: 6, goal: 6, done: true, doneOn: '2026-10-07', daysLeft: 4 });
  });

  it('jede Person: nur wer diese Woche aktiv ist, zählt', () => {
    const c: Challenge = { crew_id: 'c', week, kind: 'everyone', target: 2, created_by: 'a' };
    const rows = [...days('a', 2), row('b', '2026-10-05'), row('b', '2026-10-06', 'missed')];
    let p = challengeProgress(c, [m('a'), m('b'), m('inaktiv')], rows, '2026-10-06');
    expect(p).toMatchObject({ value: 1, goal: 2, done: false });
    rows.push(row('b', '2026-10-07'));
    p = challengeProgress(c, [m('a'), m('b'), m('inaktiv')], rows, '2026-10-07');
    expect(p).toMatchObject({ value: 2, goal: 2, done: true, doneOn: '2026-10-07' });
  });

  it('nach der Woche: keine Tage mehr übrig', () => {
    const c: Challenge = { crew_id: 'c', week, kind: 'crew_total', target: 20, created_by: 'a' };
    const p = challengeProgress(c, [m('a')], days('a', 7), '2026-10-13');
    expect(p).toMatchObject({ value: 7, done: false, daysLeft: 0 });
  });
});

describe('Crew-Feed', () => {
  it('sammelt Abzeichen, Beitritte, Reaktionen, gemeinsame Tage und Challenges', () => {
    const members = [m('a', '2026-10-01T10:00:00'), m('b', '2026-10-06T10:00:00')];
    const rows = [...days('a', 3), row('b', '2026-10-06'), row('b', '2026-10-07')];
    const challenges: Challenge[] = [{ crew_id: 'c', week, kind: 'crew_total', target: 5, created_by: 'a' }];
    const feed = buildFeed(
      {
        members,
        rows,
        reactions: [
          { id: '1', crew_id: 'c', from_user: 'a', to_user: 'b', date: '2026-10-07', emoji: '🔥' },
          { id: '2', crew_id: 'c', from_user: 'a', to_user: 'b', date: '2026-10-07', emoji: '💪' },
        ],
        badges: { a: [{ id: 'first_day', date: '2026-10-01' }, { id: 'streak_7', date: '2026-10-07' }] },
        challenges,
      },
      '2026-10-07',
    );
    expect(feed.map((f) => `${f.date} ${f.kind}`)).toEqual([
      '2026-10-07 challenge_done',
      '2026-10-07 crew_day', // 6.+7.10. zusammengefasst; am 5.10. war nur a dabei
      '2026-10-07 badge',
      '2026-10-07 reactions',
      '2026-10-06 joined',
      '2026-10-01 badge',
      '2026-10-01 joined',
    ]);
    const day = feed.find((f) => f.kind === 'crew_day');
    expect(day && day.kind === 'crew_day' && day.run).toBe(2);
    const r = feed.find((f) => f.kind === 'reactions');
    expect(r && r.kind === 'reactions' && r.emojis).toEqual(['🔥', '💪']);
  });

  it('ältere Ereignisse fallen raus', () => {
    const feed = buildFeed(
      { members: [m('a', '2026-09-01T10:00:00')], rows: [], reactions: [], badges: { a: [{ id: 'x', date: '2026-09-20' }] }, challenges: [] },
      '2026-10-07',
    );
    expect(feed).toEqual([]);
  });
});
