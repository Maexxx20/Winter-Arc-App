/**
 * Abgleich der Tagebuch-Fotos (getestet). Jedes Foto ist ein eigener Datensatz:
 * die neuere Version gewinnt, Löschen setzt eine Löschmarke. So entfernt ein Gerät
 * nie Fotos, von denen es nichts weiss.
 */

import type { ISODate } from './date';
import type { AppState, DayEntry } from './types';

export interface PhotoRecord {
  arcId: string;
  date: ISODate;
  deleted: boolean;
  updatedAt: string;
}

/** Dateiname ("photos/<id>.jpg") → Datensatz */
export type PhotoLog = Record<string, PhotoRecord>;

export interface PhotoRow {
  name: string;
  arc_id: string;
  date: ISODate;
  deleted: boolean;
  updated_at: string;
  server_updated_at?: string;
}

/** Nur Fotos aus dem Dokumentenordner lassen sich abgleichen (nicht die Data-URLs der Web-Vorschau). */
export function isSyncablePhoto(name: string): boolean {
  return /^photos\/[A-Za-z0-9_-]+\.jpg$/.test(name);
}

const EPOCH = '1970-01-01T00:00:00.000Z';
const ts = (s: string | undefined | null) => (s ? new Date(s).toISOString() : EPOCH);

/** Datensätze, die seit `since` geändert wurden (alle, wenn null). */
export function photoRowsToPush(log: PhotoLog, since: string | null): PhotoRow[] {
  return Object.entries(log)
    .filter(([name, r]) => isSyncablePhoto(name) && (since === null || ts(r.updatedAt) > ts(since)))
    .map(([name, r]) => ({ name, arc_id: r.arcId, date: r.date, deleted: r.deleted, updated_at: ts(r.updatedAt) }));
}

/** Fotos in Tageseinträgen, zu denen es noch keinen Datensatz gibt (aus älteren App-Versionen). */
export function withLegacyPhotoRecords(state: AppState): AppState {
  const log: PhotoLog = { ...(state.photoLog ?? {}) };
  let changed = false;
  for (const [arcId, days] of Object.entries(state.logs)) {
    for (const [date, e] of Object.entries(days)) {
      for (const name of e.photos ?? []) {
        if (!isSyncablePhoto(name) || log[name]) continue;
        log[name] = { arcId, date, deleted: false, updatedAt: e.updatedAt || new Date().toISOString() };
        changed = true;
      }
    }
  }
  return changed ? { ...state, photoLog: log } : state;
}

/**
 * Server-Datensätze übernehmen, wo sie neuer sind. Gibt den neuen State zurück
 * und die Fotos, deren Datei auf diesem Gerät gelöscht werden kann.
 */
export function mergePhotoRows(state: AppState, rows: PhotoRow[]): { state: AppState; removed: string[] } {
  const log: PhotoLog = { ...(state.photoLog ?? {}) };
  const logs = { ...state.logs };
  const removed: string[] = [];
  let changed = false;

  const setPhotos = (arcId: string, date: ISODate, fn: (p: string[]) => string[]) => {
    const days = { ...(logs[arcId] ?? {}) };
    const prev: DayEntry = days[date] ?? { values: {}, updatedAt: EPOCH };
    const next = fn(prev.photos ?? []);
    days[date] = { ...prev, photos: next.length ? next : undefined };
    logs[arcId] = days;
  };

  for (const row of rows) {
    if (!isSyncablePhoto(row.name)) continue;
    const local = log[row.name];
    if (local && ts(local.updatedAt) >= ts(row.updated_at)) continue;
    log[row.name] = { arcId: row.arc_id, date: row.date, deleted: row.deleted, updatedAt: ts(row.updated_at) };
    changed = true;

    // Falls das Foto zu einem anderen Tag gehörte, dort entfernen.
    if (local && (local.arcId !== row.arc_id || local.date !== row.date)) {
      setPhotos(local.arcId, local.date, (p) => p.filter((n) => n !== row.name));
    }
    if (row.deleted) {
      setPhotos(row.arc_id, row.date, (p) => p.filter((n) => n !== row.name));
      removed.push(row.name);
    } else {
      setPhotos(row.arc_id, row.date, (p) => (p.includes(row.name) ? p : [...p, row.name]));
    }
  }

  return changed ? { state: { ...state, photoLog: log, logs }, removed } : { state, removed };
}

export interface DiaryPhoto {
  name: string;
  arcId: string;
  date: ISODate;
}

/** Alle Tagebuch-Fotos (optional nur eines Arcs), ältestes zuerst – für Vorher/Nachher und Zeitraffer. */
export function diaryPhotos(state: Pick<AppState, 'logs'>, arcId?: string): DiaryPhoto[] {
  const out: DiaryPhoto[] = [];
  for (const [aid, log] of Object.entries(state.logs)) {
    if (arcId && aid !== arcId) continue;
    for (const [date, entry] of Object.entries(log)) {
      for (const name of entry.photos ?? []) out.push({ name, arcId: aid, date });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
