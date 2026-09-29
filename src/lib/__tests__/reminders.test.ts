import { describe, expect, it } from 'vitest';

import type { ArcLog } from '../arc';
import { planReminders } from '../reminders';
import type { Arc, ReminderSettings } from '../types';

const arc: Arc = {
  id: 'a',
  title: 'Winter Arc 2026',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  why: '',
  rules: [
    { id: 'r', title: 'Lesen', icon: '📖', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'check' }, activeFrom: '2026-10-01' },
  ],
  amendmentsLeft: 3,
  status: 'active',
  createdAt: '',
};
const settings: ReminderSettings = { enabled: true, morning: 7 * 60 + 30, evening: 20 * 60 + 30, weeklyReview: true };

describe('Erinnerungen', () => {
  it('nichts, wenn deaktiviert', () => {
    expect(planReminders(arc, {}, { ...settings, enabled: false }, new Date(2026, 9, 5, 8), '2026-10-05')).toEqual([]);
  });

  it('vor dem Start: Vorabend-Erinnerung und Tag 1', () => {
    const r = planReminders(arc, {}, settings, new Date(2026, 8, 30, 0, 20), '2026-09-30');
    expect(r[0].id).toBe('start-eve-2026-10-01');
    expect(r[1].title).toBe('Tag 1. Los geht’s.');
  });

  it('vergangene Zeiten werden nicht geplant', () => {
    const r = planReminders(arc, {}, settings, new Date(2026, 9, 5, 9, 0), '2026-10-05');
    expect(r.find((x) => x.id === 'morning-2026-10-05')).toBeUndefined();
    expect(r.find((x) => x.id === 'evening-2026-10-05')).toBeDefined();
  });

  it('Abend-Erinnerung entfällt, wenn der Tag gehalten ist', () => {
    const log: ArcLog = { '2026-10-05': { values: { r: 1 }, updatedAt: '' } };
    const r = planReminders(arc, log, settings, new Date(2026, 9, 5, 9, 0), '2026-10-05');
    expect(r.find((x) => x.id === 'evening-2026-10-05')).toBeUndefined();
  });

  it('dünnes Eis im Abendtext', () => {
    const log: ArcLog = { '2026-10-03': { values: { r: 1 }, updatedAt: '' } };
    const r = planReminders(arc, log, settings, new Date(2026, 9, 5, 9, 0), '2026-10-05');
    expect(r.find((x) => x.id === 'evening-2026-10-05')!.body).toMatch(/Gestern verpasst/);
  });

  it('Wochenrückblick am Sonntag, nicht nach dem Ende', () => {
    const r = planReminders(arc, {}, settings, new Date(2026, 9, 5, 9, 0), '2026-10-05');
    expect(r.some((x) => x.id === 'review-2026-10-11')).toBe(true);
    const late = planReminders(arc, {}, settings, new Date(2026, 11, 30, 9), '2026-12-30');
    expect(late.every((x) => x.date <= new Date(2026, 11, 31, 23, 59))).toBe(true);
  });
});
