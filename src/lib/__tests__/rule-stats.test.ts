import { describe, expect, it } from 'vitest';

import type { ArcLog } from '../arc';
import { rangeDays } from '../date';
import { daysSinceLastHit, ruleDetail } from '../rule-stats';
import type { Arc, Rule } from '../types';

const daily: Rule = { id: 'd', title: 'Lesen', icon: '📖', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 20, unit: 'Seiten' }, activeFrom: '2026-10-01' };
const weekly: Rule = { id: 'w', title: 'Gym', icon: '🏋️', category: 'body', frequency: { kind: 'weekly', times: 3 }, measure: { kind: 'check' }, activeFrom: '2026-10-01' };
const arc: Arc = { id: 'a', title: 'W', startDate: '2026-10-01', endDate: '2026-12-31', why: '', rules: [daily, weekly], amendmentsLeft: 3, status: 'active', createdAt: '' };

const log = (entries: Record<string, Record<string, number>>): ArcLog =>
  Object.fromEntries(Object.entries(entries).map(([d, v]) => [d, { values: v, updatedAt: '' }]));

describe('ruleDetail – tägliche Regel mit Menge', () => {
  const l: ArcLog = {};
  // 1.–10.10. je 20 Seiten, ausser 5.10. (10 Seiten) und 8.10. (30 Seiten)
  for (const d of rangeDays('2026-10-01', '2026-10-10')) l[d] = { values: { d: 20 }, updatedAt: '' };
  l['2026-10-05'].values.d = 10;
  l['2026-10-08'].values.d = 30;
  const r = ruleDetail(arc, l, daily, '2026-10-10');

  it('Quote und Serien', () => {
    expect(r).toMatchObject({ hits: 9, expected: 10, currentRun: 5, bestRun: 5, runUnit: 'Tage' });
  });
  it('Mengen', () => {
    expect(r.amount).toMatchObject({ total: 200, average: 20, best: { date: '2026-10-08', value: 30 }, unit: 'Seiten' });
  });
  it('Wochen', () => {
    expect(r.weeks.map((w) => [w.week, w.hits, w.target, w.running])).toEqual([
      ['2026-09-28', 4, 4, false], // Do–So
      ['2026-10-05', 5, 7, true],
    ]);
  });
  it('heute unerledigt zählt (noch) nicht', () => {
    const l2 = { ...l };
    delete l2['2026-10-10'];
    const r2 = ruleDetail(arc, l2, daily, '2026-10-10');
    expect(r2).toMatchObject({ expected: 9, currentRun: 4 });
  });
  it('seit dem letzten Erfüllen', () => {
    expect(daysSinceLastHit(arc, l, daily, '2026-10-12')).toBe(2);
    expect(daysSinceLastHit(arc, {}, daily, '2026-10-12')).toBeNull();
  });
});

describe('schwächster Wochentag', () => {
  it('wird erkannt, wenn der Unterschied deutlich ist', () => {
    const l: ArcLog = {};
    for (const d of rangeDays('2026-10-01', '2026-10-28')) {
      const isSunday = new Date(d + 'T12:00:00').getDay() === 0;
      if (!isSunday) l[d] = { values: { d: 20 }, updatedAt: '' };
    }
    const r = ruleDetail(arc, l, daily, '2026-10-28');
    expect(r.weakestWeekday).toBe(6); // Sonntag
    expect(r.weekdays[6]).toMatchObject({ hits: 0, rate: 0 });
  });
  it('keiner bei gleichmässigen Daten', () => {
    const l: ArcLog = {};
    for (const d of rangeDays('2026-10-01', '2026-10-28')) l[d] = { values: { d: 20 }, updatedAt: '' };
    expect(ruleDetail(arc, l, daily, '2026-10-28').weakestWeekday).toBeNull();
  });
});

describe('ruleDetail – wöchentliche Regel', () => {
  it('Serie in Wochen, laufende Woche bricht nicht', () => {
    const l = log({
      '2026-10-05': { w: 1 }, '2026-10-07': { w: 1 }, '2026-10-09': { w: 1 }, // Woche 2: 3/3
      '2026-10-12': { w: 1 }, '2026-10-14': { w: 1 }, '2026-10-16': { w: 1 }, // Woche 3: 3/3
      '2026-10-19': { w: 1 }, // Woche 4 läuft: 1/3
    });
    const r = ruleDetail(arc, l, weekly, '2026-10-20');
    // Woche 1 (Do–So, Ziel 2) verpasst → Serie danach 2 Wochen
    expect(r).toMatchObject({ currentRun: 2, bestRun: 2, runUnit: 'Wochen' });
    expect(r.weeks[0]).toMatchObject({ target: 2, hits: 0 });
    expect(r).toMatchObject({ hits: 6, expected: 8 });
  });
});
