import { describe, expect, it } from 'vitest';

import { buildStatusRows } from '../crew';
import { compareRules, type CrewArc, crewRuleRates, isMyCrewArc, joinPeriod, relevantCrewArc, toCrewArcRules } from '../crew-arc';
import type { Arc } from '../types';

const ca = (id: string, start: string, end: string): CrewArc => ({
  id, crew_id: 'c', title: id, why: '', start_date: start, end_date: end, created_by: 'a',
  rules: [
    { id: 'r1', title: 'Kalt duschen', icon: '🧊', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
    { id: 'r2', title: 'Lesen', icon: '📖', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 10, unit: 'Seiten' } },
  ],
});

describe('Crew-Arc', () => {
  it('laufender oder nächster Crew-Arc', () => {
    const list = [ca('alt', '2026-09-01', '2026-09-30'), ca('spaeter', '2026-11-01', '2026-11-30'), ca('jetzt', '2026-10-01', '2026-10-30')];
    expect(relevantCrewArc(list, '2026-10-05')?.id).toBe('jetzt');
    expect(relevantCrewArc(list, '2026-10-31')?.id).toBe('spaeter');
    expect(relevantCrewArc(list, '2026-12-01')).toBeNull();
  });
  it('Regeln ohne Health, mit IDs', () => {
    let n = 0;
    const r = toCrewArcRules([{ title: 'Training', icon: '🏋️', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' }, health: { metric: 'workout', threshold: 30 } }], () => `id${++n}`);
    expect(r).toEqual([{ id: 'id1', title: 'Training', icon: '🏋️', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' } }]);
  });
  it('später dazukommen startet heute', () => {
    const c = ca('x', '2026-10-01', '2026-10-30');
    expect(joinPeriod(c, '2026-09-20')).toEqual({ startDate: '2026-10-01', endDate: '2026-10-30' });
    expect(joinPeriod(c, '2026-10-10')).toEqual({ startDate: '2026-10-10', endDate: '2026-10-30' });
    expect(joinPeriod(c, '2026-10-31')).toBeNull();
  });
  it('Vergleich Regel für Regel, nur Unterschriebene', () => {
    const c = ca('x', '2026-10-01', '2026-10-30');
    const rows = [
      { user_id: 'a', date: '2026-10-05', status: 'done' as const, done: 2, total: 2, day_number: 5, total_days: 30, streak: 5, best_streak: 5, rate: 100, crew_arc_id: 'x', rules_done: ['r1', 'r2'] },
      { user_id: 'b', date: '2026-10-05', status: 'partial' as const, done: 1, total: 2, day_number: 5, total_days: 30, streak: 0, best_streak: 2, rate: 50, crew_arc_id: 'x', rules_done: ['r1'] },
      { user_id: 'z', date: '2026-10-05', status: 'done' as const, done: 2, total: 2, day_number: 5, total_days: 30, streak: 0, best_streak: 2, rate: 50, crew_arc_id: 'x', rules_done: ['r1', 'r2'] },
      { user_id: 'b', date: '2026-10-04', status: 'done' as const, done: 2, total: 2, day_number: 4, total_days: 30, streak: 0, best_streak: 2, rate: 50, crew_arc_id: 'x', rules_done: ['r1', 'r2'] },
    ];
    const cmp = compareRules(c, ['a', 'b'], rows, '2026-10-05');
    expect(cmp.map((x) => [x.rule.id, x.doneBy])).toEqual([['r1', ['a', 'b']], ['r2', ['a']]]);
    expect(crewRuleRates(c, ['a', 'b'], rows)).toEqual({ r1: 1, r2: 2 / 3 });
  });
  it('Status enthält erledigte Crew-Regeln', () => {
    const arc: Arc = {
      id: 'p', title: 'x', startDate: '2026-10-01', endDate: '2026-10-30', why: '', amendmentsLeft: 0, status: 'active', createdAt: '',
      rules: ca('x', '2026-10-01', '2026-10-30').rules.map((r) => ({ ...r, activeFrom: '2026-10-01' })),
      crew: { crewId: 'c', crewArcId: 'x' },
    };
    const rows = buildStatusRows(arc, { '2026-10-02': { values: { r1: 1, r2: 5 }, updatedAt: '' } }, '2026-10-02', 0);
    expect(rows[0]).toMatchObject({ crew_arc_id: 'x', rules_done: ['r1'], done: 1, total: 2 });
    expect(isMyCrewArc(arc, ca('x', '2026-10-01', '2026-10-30'))).toBe(true);
  });
});
