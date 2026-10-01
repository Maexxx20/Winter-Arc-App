import { describe, expect, it } from 'vitest';

import { exportCSV, exportJSON } from '../export';
import type { AppState, Rule } from '../types';

const rule = (id: string, extra: Partial<Rule> = {}): Rule => ({
  id, title: id, icon: '⭐', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' }, activeFrom: '2026-10-01', ...extra,
});
const state: AppState = {
  schemaVersion: 1,
  arcs: [{ id: 'a', title: 'Winter; Arc', startDate: '2026-10-01', endDate: '2026-12-31', why: '', amendmentsLeft: 3, status: 'active', createdAt: '',
    rules: [rule('Duschen'), rule('Lesen', { measure: { kind: 'amount', target: 10, unit: 'Seiten' } })] }],
  activeArcId: 'a',
  logs: { a: { '2026-10-01': { values: { Duschen: 1, Lesen: 4 }, note: 'kalt, "sehr"', updatedAt: '' } } },
  reviews: {},
  settings: {} as AppState['settings'],
  sync: { lastPushedAt: 'x', lastPulledAt: null, userId: 'u' } as unknown as AppState['sync'],
  healthAuto: { k: 1 },
};
const labels = { columns: ['Datum', 'Arc', 'Regel', 'Wert', 'Einheit', 'Erfüllt', 'Notiz'], yes: 'ja', no: 'nein' };

describe('Export', () => {
  it('CSV: Zeile pro Tag und Regel, Notiz einmal, Sonderzeichen maskiert', () => {
    const csv = exportCSV(state, '2026-10-02', labels);
    const rows = csv.replace('﻿', '').trim().split('\r\n');
    expect(rows).toHaveLength(5);
    expect(rows[1]).toBe('2026-10-01;"Winter; Arc";Duschen;1;;ja;"kalt, ""sehr"""');
    expect(rows[2]).toBe('2026-10-01;"Winter; Arc";Lesen;4;Seiten;nein;');
    expect(rows[3]).toBe('2026-10-02;"Winter; Arc";Duschen;0;;nein;');
  });
  it('JSON ohne Sync-Interna', () => {
    const data = JSON.parse(exportJSON(state, '2026-10-02T10:00:00Z'));
    expect(data.app).toBe('Nordwand');
    expect(data.arcs[0].title).toBe('Winter; Arc');
    expect(data.sync).toBeUndefined();
    expect(data.healthAuto).toBeUndefined();
  });
});
