import { describe, expect, it } from 'vitest';

import { diaryPhotos, isSyncablePhoto, mergePhotoRows, photoRowsToPush, withLegacyPhotoRecords } from '../photo-merge';
import type { AppState } from '../types';

const base = (): AppState => ({
  schemaVersion: 1,
  arcs: [],
  activeArcId: 'a',
  logs: { a: { '2026-10-01': { values: { r: 1 }, photos: ['photos/x.jpg'], updatedAt: '2026-10-01T20:00:00.000Z' } } },
  reviews: {},
  photoLog: { 'photos/x.jpg': { arcId: 'a', date: '2026-10-01', deleted: false, updatedAt: '2026-10-01T20:00:00.000Z' } },
  settings: {} as AppState['settings'],
});

describe('Foto-Sync', () => {
  it('erkennt abgleichbare Dateinamen', () => {
    expect(isSyncablePhoto('photos/Ab_1-2.jpg')).toBe(true);
    expect(isSyncablePhoto('data:image/jpeg;base64,AAA')).toBe(false);
    expect(isSyncablePhoto('photos/../x.jpg')).toBe(false);
  });

  it('alte Fotos bekommen einen Datensatz', () => {
    const s = base();
    s.photoLog = {};
    s.logs.a['2026-10-02'] = { values: {}, photos: ['photos/y.jpg', 'data:image/jpeg;base64,AAA'], updatedAt: '2026-10-02T08:00:00.000Z' };
    const n = withLegacyPhotoRecords(s);
    expect(Object.keys(n.photoLog!)).toEqual(['photos/x.jpg', 'photos/y.jpg']);
    expect(withLegacyPhotoRecords(n)).toBe(n);
  });

  it('nur Geändertes hochladen', () => {
    expect(photoRowsToPush(base().photoLog!, null)).toHaveLength(1);
    expect(photoRowsToPush(base().photoLog!, '2026-10-02T00:00:00.000Z')).toHaveLength(0);
  });

  it('neues Foto von einem anderen Gerät erscheint am richtigen Tag', () => {
    const { state, removed } = mergePhotoRows(base(), [
      { name: 'photos/z.jpg', arc_id: 'a', date: '2026-10-01', deleted: false, updated_at: '2026-10-03T08:00:00.000Z' },
      { name: 'photos/w.jpg', arc_id: 'a', date: '2026-10-05', deleted: false, updated_at: '2026-10-05T08:00:00.000Z' },
    ]);
    expect(state.logs.a['2026-10-01'].photos).toEqual(['photos/x.jpg', 'photos/z.jpg']);
    expect(state.logs.a['2026-10-05'].photos).toEqual(['photos/w.jpg']);
    expect(removed).toEqual([]);
  });

  it('Löschmarke entfernt das Foto und meldet die Datei', () => {
    const { state, removed } = mergePhotoRows(base(), [
      { name: 'photos/x.jpg', arc_id: 'a', date: '2026-10-01', deleted: true, updated_at: '2026-10-03T08:00:00.000Z' },
    ]);
    expect(state.logs.a['2026-10-01'].photos).toBeUndefined();
    expect(state.logs.a['2026-10-01'].values).toEqual({ r: 1 }); // Rest des Tages bleibt
    expect(removed).toEqual(['photos/x.jpg']);
  });

  it('ältere Server-Version ändert nichts', () => {
    const s = base();
    const { state, removed } = mergePhotoRows(s, [
      { name: 'photos/x.jpg', arc_id: 'a', date: '2026-10-01', deleted: true, updated_at: '2026-09-30T08:00:00.000Z' },
    ]);
    expect(state).toBe(s);
    expect(removed).toEqual([]);
  });

  it('lokal gelöscht und neuer als der Server: bleibt gelöscht', () => {
    const s = base();
    s.photoLog!['photos/x.jpg'] = { arcId: 'a', date: '2026-10-01', deleted: true, updatedAt: '2026-10-04T08:00:00.000Z' };
    s.logs.a['2026-10-01'].photos = undefined;
    const { state } = mergePhotoRows(s, [
      { name: 'photos/x.jpg', arc_id: 'a', date: '2026-10-01', deleted: false, updated_at: '2026-10-03T08:00:00.000Z' },
    ]);
    expect(state).toBe(s);
  });
});

describe('Tagebuch-Fotos für Vorher/Nachher', () => {
  const s: AppState = {
    schemaVersion: 1, arcs: [], activeArcId: null, reviews: {}, settings: {} as AppState['settings'],
    logs: {
      a: { '2026-10-08': { values: {}, photos: ['photos/c.jpg', 'photos/b.jpg'], updatedAt: '' }, '2026-10-01': { values: {}, photos: ['photos/a.jpg'], updatedAt: '' } },
      z: { '2026-01-02': { values: {}, photos: ['photos/old.jpg'], updatedAt: '' } },
    },
  };
  it('ältestes zuerst, optional nur ein Arc', () => {
    expect(diaryPhotos(s).map((p) => p.name)).toEqual(['photos/old.jpg', 'photos/a.jpg', 'photos/b.jpg', 'photos/c.jpg']);
    expect(diaryPhotos(s, 'a').map((p) => p.date)).toEqual(['2026-10-01', '2026-10-08', '2026-10-08']);
  });
  it('Web-Vorschauen werden nicht hochgeladen', () => {
    expect(photoRowsToPush({ 'data:image/jpeg;base64,xx': { arcId: 'a', date: '2026-10-01', deleted: false, updatedAt: '2026-10-01' } }, null)).toEqual([]);
  });
});
