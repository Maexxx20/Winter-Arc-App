import { describe, expect, it } from 'vitest';

import type { AppState, Rule } from '../types';
import { widgetData, widgetTapsToApply } from '../widget-data';

const rule = (id: string, extra: Partial<Rule> = {}): Rule => ({
  id, title: id, icon: '⭐', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' }, activeFrom: '2026-10-01', ...extra,
});
const state = (): AppState => ({
  schemaVersion: 1,
  arcs: [{
    id: 'a', title: 'Winter Arc 2026', startDate: '2026-10-01', endDate: '2026-12-31', why: '',
    rules: [rule('r1'), rule('r2', { measure: { kind: 'amount', target: 20, unit: 'Seiten' } }), rule('w', { frequency: { kind: 'weekly', times: 3 } })],
    amendmentsLeft: 3, status: 'active', createdAt: '',
  }],
  activeArcId: 'a',
  logs: { a: { '2026-10-02': { values: { r1: 1 }, updatedAt: '' } } },
  reviews: {},
  settings: {} as AppState['settings'],
});

describe('Widget-Daten', () => {
  it('laufender Arc: Tag, Fortschritt, nur tägliche Regeln', () => {
    const d = widgetData(state(), '2026-10-02')!;
    expect(d).toMatchObject({ dayNumber: 2, totalDays: 92, done: 1, total: 2, started: true, streak: 0 });
    expect(d.rules.map((r) => [r.id, r.done])).toEqual([['r1', true], ['r2', false]]);
  });
  it('vor dem Start: Countdown', () => {
    expect(widgetData(state(), '2026-09-28')).toMatchObject({ started: false, daysToStart: 3 });
  });
  it('ohne Arc: nichts', () => {
    expect(widgetData({ ...state(), activeArcId: null }, '2026-10-02')).toBeNull();
  });
  it('Taps aus dem Widget übernehmen, Erledigtes nicht doppelt', () => {
    expect(widgetTapsToApply(state(), { date: '2026-10-02', tapped: ['r1', 'r2', 'r2', 'x'] })).toEqual({ r2: 20 });
  });
});
