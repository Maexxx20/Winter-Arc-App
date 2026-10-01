import { describe, expect, it } from 'vitest';

import type { AppState, Rule } from '../types';
import { widgetData, widgetDataWithLabels, widgetTapsToApply } from '../widget-data';

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
  it('nach dem Ende: «vorbei», keine Regeln', () => {
    expect(widgetData(state(), '2027-01-01')).toMatchObject({ ended: true, rules: [], title: 'Winter Arc 2026' });
    expect(widgetTapsToApply(state(), { date: '2027-01-01', tapped: ['r1'] })).toEqual({});
  });
  it('Texte kommen fertig mit, «heute» bleibt eine Vorlage', () => {
    const tr = (k: string, v?: Record<string, string | number>) => `${k}${v ? JSON.stringify(v) : ''}`;
    const d = widgetDataWithLabels(state(), '2026-10-02', tr);
    expect(d.labels.dayOf).toBe('widget.dayOf{"day":2,"total":92}');
    expect(d.labels.today).toBe('widget.today{"done":"{done}","total":"{total}"}');
    expect(widgetDataWithLabels({ ...state(), activeArcId: null }, '2026-10-02', tr)).toMatchObject({ ended: true, labels: { noArc: 'widget.noArc' } });
  });
  it('Taps aus dem Widget übernehmen, Erledigtes nicht doppelt', () => {
    expect(widgetTapsToApply(state(), { date: '2026-10-02', tapped: ['r1', 'r2', 'r2', 'x'] })).toEqual({ r2: 20 });
  });
});
