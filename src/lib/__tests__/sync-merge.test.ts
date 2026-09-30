import { describe, expect, it } from 'vitest';

import { collectChanges, mergeRemote } from '../sync-merge';
import type { AppState, Arc } from '../types';

const arc = (id: string, updatedAt: string, extra: Partial<Arc> = {}): Arc => ({
  id,
  title: id,
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  why: '',
  rules: [],
  amendmentsLeft: 3,
  status: 'active',
  createdAt: '2026-09-29T10:00:00.000Z',
  updatedAt,
  ...extra,
});

const base = (): AppState => ({
  schemaVersion: 1,
  arcs: [arc('a', '2026-10-01T10:00:00.000Z')],
  activeArcId: 'a',
  logs: {
    a: {
      '2026-10-01': { values: { r: 1 }, updatedAt: '2026-10-01T20:00:00.000Z', photos: ['photos/x.jpg'] },
      '2026-10-02': { values: { r: 1 }, updatedAt: '2026-10-02T20:00:00.000Z' },
    },
  },
  reviews: {},
  settings: { name: 'M', motto: '', instagram: '', avatar: { local: null, remote: null }, profileUpdatedAt: null, seenBadges: null, crewPush: null, rolloverHour: 0, haptics: true, reminders: { enabled: null, morning: 450, evening: 1230, weeklyReview: true } },
});

describe('collectChanges', () => {
  it('alles beim ersten Mal', () => {
    const c = collectChanges(base(), null);
    expect(c.arcs).toHaveLength(1);
    expect(c.entries).toHaveLength(2);
  });
  it('nur Neueres danach', () => {
    const c = collectChanges(base(), '2026-10-01T21:00:00.000Z');
    expect(c.arcs).toHaveLength(0);
    expect(c.entries.map((e) => e.date)).toEqual(['2026-10-02']);
  });
  it('nennt nur hochgeladene Fotos', () => {
    let c = collectChanges(base(), null);
    expect(c.entries.find((e) => e.date === '2026-10-01')?.photos).toEqual([]);
    c = collectChanges(base(), null, { uploaded: new Set(['photos/x.jpg']) });
    expect(c.entries.find((e) => e.date === '2026-10-01')?.photos).toEqual(['photos/x.jpg']);
  });
  it('Einträge mit frisch hochgeladenen Fotos kommen mit, auch wenn sie älter sind', () => {
    const c = collectChanges(base(), '2026-10-05T00:00:00.000Z', { uploaded: new Set(['photos/x.jpg']), alsoEntries: new Set(['a|2026-10-01']) });
    expect(c.entries.map((e) => e.date)).toEqual(['2026-10-01']);
  });
  it('Data-URLs der Web-Vorschau werden nie genannt', () => {
    const s = base();
    s.logs.a['2026-10-02'].photos = ['data:image/jpeg;base64,AAA'];
    const c = collectChanges(s, null, { uploaded: new Set(['data:image/jpeg;base64,AAA']) });
    expect(c.entries.find((e) => e.date === '2026-10-02')?.photos).toEqual([]);
  });
});

describe('mergeRemote', () => {
  it('neuere Server-Version gewinnt, Fotos bleiben', () => {
    const s = mergeRemote(base(), {
      arcs: [],
      entries: [{ arc_id: 'a', date: '2026-10-01', values: { r: 0 }, note: 'hi', updated_at: '2026-10-03T08:00:00.000Z' }],
      reviews: [],
    });
    expect(s.logs.a['2026-10-01']).toMatchObject({ values: { r: 0 }, note: 'hi', photos: ['photos/x.jpg'] });
  });
  it('Fotos vom Server; noch nicht hochgeladene lokale bleiben', () => {
    const s = mergeRemote(base(), {
      arcs: [],
      entries: [{ arc_id: 'a', date: '2026-10-01', values: {}, note: null, photos: ['photos/y.jpg'], updated_at: '2026-10-03T08:00:00.000Z' }],
      reviews: [],
    });
    expect(s.logs.a['2026-10-01'].photos).toEqual(['photos/y.jpg', 'photos/x.jpg']);
  });
  it('hochgeladenes, auf einem anderen Gerät gelöschtes Foto verschwindet', () => {
    const s = mergeRemote(
      base(),
      { arcs: [], entries: [{ arc_id: 'a', date: '2026-10-01', values: {}, note: null, photos: [], updated_at: '2026-10-03T08:00:00.000Z' }], reviews: [] },
      new Set(['photos/x.jpg']),
    );
    expect(s.logs.a['2026-10-01'].photos).toBeUndefined();
  });
  it('ältere Server-Version wird ignoriert → gleicher State', () => {
    const st = base();
    const s = mergeRemote(st, {
      arcs: [{ id: 'a', data: arc('a', '2026-09-30T00:00:00.000Z', { title: 'alt' }), status: 'active', updated_at: '2026-09-30T00:00:00.000Z' }],
      entries: [{ arc_id: 'a', date: '2026-10-02', values: {}, note: null, updated_at: '2026-10-01T00:00:00.000Z' }],
      reviews: [],
    });
    expect(s).toBe(st);
  });
  it('neues Gerät: Arc wird übernommen und aktiv', () => {
    const empty: AppState = { ...base(), arcs: [], logs: {}, activeArcId: null };
    const s = mergeRemote(empty, {
      arcs: [{ id: 'b', data: arc('b', '2026-10-05T00:00:00.000Z'), status: 'active', updated_at: '2026-10-05T00:00:00.000Z' }],
      entries: [],
      reviews: [{ arc_id: 'b', week: '2026-10-05', data: { rating: 4, wins: '', obstacles: '', nextWeek: '' }, updated_at: '2026-10-11T19:00:00.000Z' }],
    });
    expect(s.activeArcId).toBe('b');
    expect(s.reviews.b['2026-10-05'].rating).toBe(4);
  });
});
