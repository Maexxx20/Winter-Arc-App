import { describe, expect, it } from 'vitest';

import type { ArcLog } from '../arc';
import { allBadges, arcBadges, badgeKey, badgeSummary, freshBadges } from '../badges';
import { addDays, rangeDays } from '../date';
import type { Arc, Rule } from '../types';

const rule: Rule = {
  id: 'r',
  title: 'Training',
  icon: '⭐',
  category: 'body',
  frequency: { kind: 'daily' },
  measure: { kind: 'check' },
  activeFrom: '2026-10-01',
};
const arc = (extra: Partial<Arc> = {}): Arc => ({
  id: 'a',
  title: 'Winter Arc',
  startDate: '2026-10-01', // Donnerstag
  endDate: '2026-12-31',
  why: '',
  rules: [rule],
  amendmentsLeft: 3,
  status: 'active',
  createdAt: '2026-09-30T12:00:00Z',
  ...extra,
});
const doneDays = (from: string, to: string, log: ArcLog = {}) => {
  for (const d of rangeDays(from, to)) log[d] = { values: { r: 1 }, updatedAt: '' };
  return log;
};
const ids = (list: { id: string }[]) => list.map((b) => b.id);

describe('Abzeichen', () => {
  it('vor dem Start nichts', () => {
    expect(arcBadges(arc(), {}, {}, '2026-09-30')).toEqual([]);
  });

  it('erster Tag und 7er-Streak mit Datum', () => {
    const log = doneDays('2026-10-01', '2026-10-07');
    const b = arcBadges(arc(), log, {}, '2026-10-07');
    expect(b.find((x) => x.id === 'first_day')?.date).toBe('2026-10-01');
    expect(b.find((x) => x.id === 'streak_7')?.date).toBe('2026-10-07');
    expect(ids(b)).not.toContain('streak_21');
  });

  it('perfekte Woche nur für volle Woche Mo–So', () => {
    // 1.10. ist Donnerstag → erste volle Woche 5.–11.10.
    const log = doneDays('2026-10-01', '2026-10-10');
    expect(ids(arcBadges(arc(), log, {}, '2026-10-10'))).not.toContain('perfect_week');
    doneDays('2026-10-11', '2026-10-11', log);
    const b = arcBadges(arc(), log, {}, '2026-10-11');
    expect(b.find((x) => x.id === 'perfect_week')?.date).toBe('2026-10-11');
  });

  it('Schild und Comeback', () => {
    const log = doneDays('2026-10-01', '2026-10-03');
    // 4.10. verpasst → Schild; 5.+6.10. verpasst → Bruch; ab 7.10. wieder 7 Tage
    doneDays('2026-10-07', '2026-10-13', log);
    const b = arcBadges(arc(), log, {}, '2026-10-13');
    expect(b.find((x) => x.id === 'shield')?.date).toBe('2026-10-04');
    expect(b.find((x) => x.id === 'comeback')?.date).toBe('2026-10-13');
    expect(b.find((x) => x.id === 'streak_7')?.date).toBe('2026-10-13'); // zählt auch nach einem Bruch
  });

  it('mit Schild ohne Bruch: 7er-Streak, aber kein Comeback', () => {
    const log = doneDays('2026-10-01', '2026-10-03');
    doneDays('2026-10-05', '2026-10-08', log); // 4.10. vom Schild gerettet
    const b = arcBadges(arc(), log, {}, '2026-10-08');
    expect(b.find((x) => x.id === 'streak_7')?.date).toBe('2026-10-08');
    expect(ids(b)).not.toContain('comeback');
  });

  it('perfekter Monat Oktober', () => {
    const log = doneDays('2026-10-01', '2026-10-31');
    const b = arcBadges(arc(), log, {}, '2026-10-31');
    expect(b.find((x) => x.id === 'perfect_month')?.date).toBe('2026-10-31');
    expect(ids(b)).toContain('streak_30');
  });

  it('Halbzeit am Tag 46 von 92', () => {
    const b = arcBadges(arc(), {}, {}, '2026-11-15');
    expect(b.find((x) => x.id === 'halfway')?.date).toBe(addDays('2026-10-01', 45));
  });

  it('Tagebuch und Rückblicke', () => {
    const log: ArcLog = {};
    for (const d of rangeDays('2026-10-01', '2026-10-10')) log[d] = { values: {}, note: 'x', updatedAt: '' };
    const review = { rating: 4, wins: '', obstacles: '', nextWeek: '', updatedAt: '' };
    const reviews = { '2026-09-28': review, '2026-10-05': review, '2026-10-12': review, '2026-10-19': review };
    const b = arcBadges(arc(), log, reviews, '2026-10-25');
    expect(b.find((x) => x.id === 'journal_10')?.date).toBe('2026-10-10');
    expect(b.find((x) => x.id === 'review_4')?.date).toBe('2026-10-25');
  });

  it('Gipfel und Nordwand nach dem Ende', () => {
    const short = arc({ startDate: '2026-10-01', endDate: '2026-10-10' });
    const log = doneDays('2026-10-01', '2026-10-10');
    expect(ids(arcBadges(short, log, {}, '2026-10-10'))).not.toContain('summit');
    const b = arcBadges(short, log, {}, '2026-10-11');
    expect(ids(b)).toEqual(expect.arrayContaining(['summit', 'north_face']));
    delete log['2026-10-05'];
    delete log['2026-10-06'];
    const b2 = arcBadges(short, log, {}, '2026-10-11');
    expect(ids(b2)).toContain('summit'); // 8 von 10 = 80 %
    expect(ids(b2)).not.toContain('north_face');
  });

  it('abgebrochener Arc zählt nur bis zum Abbruch', () => {
    const a = arc({ status: 'abandoned', updatedAt: '2026-10-05T10:00:00' });
    const b = allBadges([a], { a: doneDays('2026-10-01', '2026-10-31') }, {}, '2026-11-30');
    expect(ids(b)).toEqual(['first_day']);
  });

  it('frische Abzeichen: ungesehen und höchstens von gestern', () => {
    const log = doneDays('2026-10-01', '2026-10-07');
    const earned = arcBadges(arc(), log, {}, '2026-10-07');
    const fresh = freshBadges(earned, [badgeKey({ id: 'first_day', arcId: 'a' })], '2026-10-07');
    expect(ids(fresh)).toEqual(['streak_7']);
  });

  it('Zusammenfassung über mehrere Arcs', () => {
    const s = badgeSummary([
      { id: 'streak_7', arcId: 'a', date: '2026-10-07' },
      { id: 'streak_7', arcId: 'b', date: '2025-10-07' },
    ]);
    expect(s.get('streak_7')).toEqual({ count: 2, first: '2025-10-07' });
  });
});
