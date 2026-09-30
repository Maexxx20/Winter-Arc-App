import { describe, expect, it } from 'vitest';

import type { ArcLog } from '../arc';
import { buildStatusRows, type CrewMember, normalizeCode, rankMembers, type StatusRow } from '../crew';
import type { Arc } from '../types';

const arc: Arc = {
  id: 'a',
  title: 'W',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  why: '',
  rules: [
    { id: 'r', title: 'Lesen', icon: '📖', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'check' }, activeFrom: '2026-10-01' },
    { id: 'g', title: 'Gym', icon: '🏋️', category: 'body', frequency: { kind: 'weekly', times: 3 }, measure: { kind: 'check' }, activeFrom: '2026-10-01' },
  ],
  amendmentsLeft: 3,
  status: 'active',
  createdAt: '',
};

describe('buildStatusRows', () => {
  it('vor dem Start nichts', () => {
    expect(buildStatusRows(arc, {}, '2026-09-30')).toEqual([]);
  });
  it('am ersten Tag nur heute', () => {
    const rows = buildStatusRows(arc, {}, '2026-10-01');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2026-10-01', status: 'open', done: 0, total: 1, day_number: 1, total_days: 92 });
  });
  it('drei Tage mit Status und aktuellem Streak', () => {
    const log: ArcLog = {
      '2026-10-03': { values: { r: 1 }, updatedAt: '' },
      '2026-10-04': { values: { r: 1 }, updatedAt: '' },
      '2026-10-05': { values: { r: 1 }, updatedAt: '' },
    };
    const rows = buildStatusRows(arc, log, '2026-10-05');
    expect(rows.map((r) => r.status)).toEqual(['done', 'done', 'done']);
    expect(rows[2]).toMatchObject({ streak: 3, done: 1, total: 1 });
  });
});

describe('rankMembers', () => {
  const m = (id: string, name: string): CrewMember => ({ crew_id: 'c', user_id: id, display_name: name, role: 'member', joined_at: '' });
  const row = (user: string, date: string, rate: number, streak: number, status: StatusRow['status'] = 'done'): StatusRow => ({
    user_id: user, date, status, done: 1, total: 1, day_number: 1, total_days: 92, streak, best_streak: streak, rate,
  });

  it('sortiert nach Quote, dann Streak; Inaktive ans Ende; Gleichstand teilt den Rang', () => {
    const today = '2026-10-10';
    const list = rankMembers(
      [m('a', 'Anna'), m('b', 'Ben'), m('c', 'Cem'), m('d', 'Dora')],
      [
        row('a', today, 80, 5),
        row('b', today, 90, 2),
        row('c', '2026-10-01', 100, 9), // lange nichts veröffentlicht
        row('d', today, 80, 5, 'open'),
      ],
      today,
    );
    expect(list.map((x) => x.member.user_id)).toEqual(['b', 'a', 'd', 'c']);
    expect(list.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
    expect(list[3].inactive).toBe(true);
    expect(list[1].heldToday).toBe(true);
    expect(list[2].heldToday).toBe(false);
  });

  it('Wochenpunkte: ältester zuerst', () => {
    const list = rankMembers([m('a', 'A')], [row('a', '2026-10-10', 50, 1), row('a', '2026-10-08', 50, 1, 'missed')], '2026-10-10');
    expect(list[0].week).toEqual([undefined, undefined, undefined, undefined, 'missed', undefined, 'done']);
  });
});

it('normalizeCode', () => {
  expect(normalizeCode(' ab-c 12x9 ')).toBe('ABC12X');
});
