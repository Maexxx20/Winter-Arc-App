import { describe, expect, it } from 'vitest';

import type { ArcLog } from '../arc';
import { addDays, rangeDays } from '../date';
import { buildRecap } from '../recap';
import type { Arc } from '../types';

const arc: Arc = {
  id: 'a',
  title: 'Test Arc',
  startDate: '2026-10-05', // Montag
  endDate: '2026-10-25', // 3 Wochen
  why: '',
  rules: [
    { id: 'dusche', title: 'Kalt duschen', icon: '🧊', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' }, activeFrom: '2026-10-05' },
    { id: 'lesen', title: 'Lesen', icon: '📖', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 10, unit: 'Seiten' }, activeFrom: '2026-10-05' },
  ],
  amendmentsLeft: 3,
  status: 'active',
  createdAt: '',
};

/** Duschen jeden Tag; Lesen nie am Montag (da wird der Tag nicht gehalten), sonst 12 Seiten. */
function makeLog(): ArcLog {
  const log: ArcLog = {};
  for (const d of rangeDays(arc.startDate, arc.endDate)) {
    const monday = new Date(`${d}T12:00:00`).getDay() === 1;
    log[d] = { values: monday ? { dusche: 1 } : { dusche: 1, lesen: 12 }, updatedAt: '' };
  }
  return log;
}

describe('Arc-Rückblick', () => {
  it('Zahlen nach dem Ende', () => {
    const log = makeLog();
    log['2026-10-05'] = { ...log['2026-10-05'], photos: ['photos/a.jpg'] };
    log['2026-10-25'] = { ...log['2026-10-25'], photos: ['photos/b.jpg', 'photos/c.jpg'] };
    const r = buildRecap(arc, log, {}, '2026-10-26');
    expect(r.finished).toBe(true);
    expect(r.totalDays).toBe(21);
    expect(r.heldDays).toBe(18);
    expect(r.strongest?.rule.id).toBe('dusche');
    expect(r.hardest?.rule.id).toBe('lesen');
    expect(r.hardestWeekday).toBe(0); // Montag
    expect(r.amounts).toEqual([{ rule: arc.rules[1], total: 18 * 12, unit: 'Seiten' }]);
    expect(r.bestWeek).toEqual({ index: 1, held: 6, days: 7 });
    expect(r.progress?.first.name).toBe('photos/a.jpg');
    expect(r.progress?.last.name).toBe('photos/c.jpg');
  });

  it('Zwischenstand und wenig Daten', () => {
    const r = buildRecap(arc, {}, {}, addDays(arc.startDate, 1));
    expect(r.finished).toBe(false);
    expect(r.heldDays).toBe(0);
    expect(r.strongest).toBeNull();
    expect(r.hardestWeekday).toBeNull();
    expect(r.bestWeek).toBeNull();
    expect(r.progress).toBeNull();
  });
});
