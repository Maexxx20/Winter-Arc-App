import { describe, expect, it } from 'vitest';

import { arcWeeks as arcWeeksFn, computeStats, computeStreak, dayProgress, weekSummary as weekSummaryFn, weeklyCount, type ArcLog } from '../arc';
import { addDays, diffDays, rangeDays, todayISO, weekStart } from '../date';
import type { Arc, Rule } from '../types';

const daily = (id: string, extra: Partial<Rule> = {}): Rule => ({
  id,
  title: id,
  icon: '⭐',
  category: 'body',
  frequency: { kind: 'daily' },
  measure: { kind: 'check' },
  activeFrom: '2026-10-01',
  ...extra,
});

const makeArc = (rules: Rule[]): Arc => ({
  id: 'arc',
  title: 'Winter Arc',
  startDate: '2026-10-01', // Donnerstag
  endDate: '2026-12-31',
  why: '',
  rules,
  amendmentsLeft: 3,
  status: 'active',
  createdAt: '2026-09-29T12:00:00Z',
});

const doneOn = (log: ArcLog, dates: string[], ids: string[]) => {
  for (const d of dates) {
    log[d] = { values: Object.fromEntries(ids.map((i) => [i, 1])), updatedAt: '' };
  }
  return log;
};

describe('date', () => {
  it('rechnet über die Zeitumstellung korrekt', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(diffDays('2026-10-01', '2026-12-31')).toBe(91);
    expect(rangeDays('2026-10-01', '2026-12-31')).toHaveLength(92);
  });
  it('Wochenstart ist Montag', () => {
    expect(weekStart('2026-10-01')).toBe('2026-09-28');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-04')).toBe('2026-09-28');
  });
  it('rolloverHour verschiebt den Tag', () => {
    expect(todayISO(new Date(2026, 9, 2, 1, 30), 3)).toBe('2026-10-01');
    expect(todayISO(new Date(2026, 9, 2, 4, 0), 3)).toBe('2026-10-02');
  });
});

describe('Streak', () => {
  const arc = makeArc([daily('a'), daily('b')]);

  it('zählt erledigte Tage, heute offen bricht nicht', () => {
    const log = doneOn({}, ['2026-10-01', '2026-10-02', '2026-10-03'], ['a', 'b']);
    const s = computeStreak(arc, log, '2026-10-04');
    expect(s.current).toBe(3);
    expect(s.statuses['2026-10-04']).toBe('open');
  });

  it('teilweise erledigt = partial', () => {
    const log = doneOn({}, ['2026-10-01'], ['a']);
    expect(dayProgress(arc, log, '2026-10-01')).toEqual({ done: 1, total: 2, ratio: 0.5 });
    expect(computeStreak(arc, log, '2026-10-02').statuses['2026-10-01']).toBe('partial');
  });

  it('ein verpasster Tag wird vom Schild gerettet', () => {
    const log = doneOn({}, ['2026-10-05', '2026-10-06', '2026-10-08'], ['a', 'b']);
    const s = computeStreak(makeArc([daily('a', { activeFrom: '2026-10-01' }), daily('b')]), log, '2026-10-09');
    // 1.–4. verpasst (Streak 0, kein Schild), 5.+6. erledigt, 7. Schild, 8. erledigt
    expect(s.statuses['2026-10-07']).toBe('shielded');
    expect(s.current).toBe(3);
    expect(s.shieldAvailable).toBe(false);
  });

  it('zwei verpasste Tage in Folge beenden den Streak', () => {
    const log = doneOn({}, ['2026-10-05', '2026-10-06'], ['a', 'b']);
    const s = computeStreak(arc, log, '2026-10-10');
    expect(s.statuses['2026-10-07']).toBe('shielded');
    expect(s.statuses['2026-10-08']).toBe('missed');
    expect(s.current).toBe(0);
    expect(s.best).toBe(2);
  });

  it('nur ein Schild pro Woche', () => {
    const dates = ['2026-10-05', '2026-10-07', '2026-10-09'];
    const log = doneOn({}, dates, ['a', 'b']);
    const s = computeStreak(arc, log, '2026-10-10');
    expect(s.statuses['2026-10-06']).toBe('shielded');
    expect(s.statuses['2026-10-08']).toBe('missed');
    expect(s.current).toBe(1);
  });

  it('neue Woche bringt neues Schild', () => {
    const dates = ['2026-10-05', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-13'];
    const log = doneOn({}, dates, ['a', 'b']);
    const s = computeStreak(arc, log, '2026-10-14');
    expect(s.statuses['2026-10-06']).toBe('shielded');
    expect(s.statuses['2026-10-12']).toBe('shielded');
    expect(s.current).toBe(7);
  });

  it('onThinIce nach verpasstem gestern', () => {
    const log = doneOn({}, ['2026-10-01', '2026-10-02'], ['a', 'b']);
    expect(computeStreak(arc, log, '2026-10-04').onThinIce).toBe(true);
    expect(computeStreak(arc, log, '2026-10-03').onThinIce).toBe(false);
  });
});

describe('Regeln über die Zeit', () => {
  it('entfernte Regel zählt ab removedOn nicht mehr', () => {
    const arc = makeArc([daily('a'), daily('b', { removedOn: '2026-10-03' })]);
    const log = doneOn({}, ['2026-10-01', '2026-10-02'], ['a', 'b']);
    doneOn(log, ['2026-10-03'], ['a']);
    const s = computeStreak(arc, log, '2026-10-04');
    expect(s.statuses['2026-10-03']).toBe('done');
    expect(s.current).toBe(3);
  });

  it('Mengen-Regel braucht Zielwert', () => {
    const arc = makeArc([daily('read', { measure: { kind: 'amount', target: 10, unit: 'Seiten' } })]);
    const log: ArcLog = { '2026-10-01': { values: { read: 6 }, updatedAt: '' } };
    expect(dayProgress(arc, log, '2026-10-01').done).toBe(0);
    log['2026-10-01'].values.read = 12;
    expect(dayProgress(arc, log, '2026-10-01').done).toBe(1);
  });
});

describe('Statistik', () => {
  const gym: Rule = daily('gym', { frequency: { kind: 'weekly', times: 3 } });
  const arc = makeArc([daily('a'), gym]);

  it('Tagnummer, Resttage und Quote', () => {
    const log = doneOn({}, ['2026-10-01', '2026-10-02'], ['a']);
    const st = computeStats(arc, log, '2026-10-04');
    expect(st.totalDays).toBe(92);
    expect(st.dayNumber).toBe(4);
    expect(st.daysLeft).toBe(89);
    expect(st.evaluatedDays).toBe(3); // 1.–3. (heute offen zählt nicht)
    expect(st.doneDays).toBe(2);
    expect(st.shieldedDays).toBe(1);
  });

  it('vor dem Start', () => {
    const st = computeStats(arc, {}, '2026-09-29');
    expect(st.started).toBe(false);
    expect(st.dayNumber).toBe(0);
    expect(st.daysLeft).toBe(92);
  });

  it('wöchentliche Regel zählt pro Woche', () => {
    const log = doneOn({}, ['2026-10-05', '2026-10-07'], ['gym']);
    expect(weeklyCount(arc, log, gym, '2026-10-08')).toBe(2);
    expect(weeklyCount(arc, log, gym, '2026-10-12')).toBe(0);
  });

  it('wöchentliche Konsistenz: laufende Woche wird nicht bestraft', () => {
    const log = doneOn({}, ['2026-10-01', '2026-10-02', '2026-10-05'], ['gym']);
    const st = computeStats(arc, log, '2026-10-06');
    const g = st.ruleStats.find((r) => r.rule.id === 'gym')!;
    // Woche 1 (Do–So = 4 Tage): erwartet ceil(3*4/7)=2, erreicht 2. Laufende Woche: 1/1.
    expect(g.expected).toBe(3);
    expect(g.hits).toBe(3);
  });
});

describe('Wochen', () => {
  const arc = makeArc([daily('a')]);
  it('arcWeeks deckt den ganzen Arc ab', () => {
    const w = arcWeeksFn(arc);
    expect(w[0]).toBe('2026-09-28');
    expect(w[w.length - 1]).toBe('2026-12-28');
    expect(w).toHaveLength(14);
  });
  it('weekSummary zählt gehaltene Tage', () => {
    const log = doneOn({}, ['2026-10-05', '2026-10-06', '2026-10-08'], ['a']);
    const s = weekSummaryFn(arc, log, '2026-10-05', '2026-10-20');
    expect(s.index).toBe(2);
    expect(s.held).toBe(3);
    expect(s.days).toHaveLength(7);
    expect(s.complete).toBe(true);
    expect(s.rules[0]).toMatchObject({ hits: 3, expected: 7 });
  });
  it('erste Woche hat nur Tage im Arc', () => {
    const s = weekSummaryFn(arc, {}, '2026-09-28', '2026-10-02');
    expect(s.days.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(s.complete).toBe(false);
  });
});
