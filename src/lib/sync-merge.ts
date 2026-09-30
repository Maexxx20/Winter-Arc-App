/**
 * Reine Funktionen für den Abgleich mit dem Server (getestet).
 * Regel: Die neuere Version (updatedAt) gewinnt.
 * Fotos: Der Eintrag nennt nur die Dateinamen; die Bilder selbst liegen im Speicher-Bucket «photos».
 */

import type { ISODate } from './date';
import type { AppState, Arc, DayEntry, WeekReview } from './types';

export interface ArcRow {
  id: string;
  data: Arc;
  status: string;
  updated_at: string;
}
export interface EntryRow {
  arc_id: string;
  date: ISODate;
  values: Record<string, number>;
  note: string | null;
  /** Namen der hochgeladenen Fotos ("photos/<id>.jpg"); fehlt bei Servern ohne Migration 0006. */
  photos?: string[];
  updated_at: string;
}
export interface ReviewRow {
  arc_id: string;
  week: ISODate;
  data: Omit<WeekReview, 'updatedAt'>;
  updated_at: string;
}

export interface ChangeSet {
  arcs: ArcRow[];
  entries: EntryRow[];
  reviews: ReviewRow[];
}

const EPOCH = '1970-01-01T00:00:00.000Z';

/** Nur Fotos aus dem Dokumentenordner lassen sich abgleichen (nicht die Data-URLs der Web-Vorschau). */
export function isSyncablePhoto(name: string): boolean {
  return /^photos\/[A-Za-z0-9_-]+\.jpg$/.test(name);
}
const ts = (s: string | undefined | null) => (s ? new Date(s).toISOString() : EPOCH);
const newer = (a: string | undefined | null, b: string | undefined | null) => ts(a) > ts(b);

/** Alles, was seit `since` lokal geändert wurde (oder alles, wenn `since` null ist). */
export function collectChanges(
  state: AppState,
  since: string | null,
  opts: { uploaded?: ReadonlySet<string>; alsoEntries?: ReadonlySet<string> } = {},
): ChangeSet {
  const after = (u: string | undefined) => since === null || newer(u, since);
  const uploaded = opts.uploaded ?? new Set<string>();
  const arcs: ArcRow[] = state.arcs
    .filter((a) => after(a.updatedAt ?? a.createdAt))
    .map((a) => ({ id: a.id, data: a, status: a.status, updated_at: ts(a.updatedAt ?? a.createdAt) }));

  const entries: EntryRow[] = [];
  for (const [arcId, log] of Object.entries(state.logs)) {
    for (const [date, e] of Object.entries(log)) {
      if (!after(e.updatedAt) && !opts.alsoEntries?.has(`${arcId}|${date}`)) continue;
      entries.push({
        arc_id: arcId,
        date,
        values: e.values,
        note: e.note ?? null,
        // Nur schon hochgeladene Fotos nennen – sonst zeigt ein anderes Gerät ein leeres Bild.
        photos: (e.photos ?? []).filter((p) => isSyncablePhoto(p) && uploaded.has(p)),
        updated_at: ts(e.updatedAt),
      });
    }
  }

  const reviews: ReviewRow[] = [];
  for (const [arcId, byWeek] of Object.entries(state.reviews ?? {})) {
    for (const [week, r] of Object.entries(byWeek)) {
      if (!after(r.updatedAt)) continue;
      const { updatedAt, ...data } = r;
      reviews.push({ arc_id: arcId, week, data, updated_at: ts(updatedAt) });
    }
  }

  // Einträge nur für Arcs, die es gibt (Fremdschlüssel).
  const known = new Set(state.arcs.map((a) => a.id));
  return {
    arcs,
    entries: entries.filter((e) => known.has(e.arc_id)),
    reviews: reviews.filter((r) => known.has(r.arc_id)),
  };
}

/** Übernimmt Server-Daten, wo sie neuer sind. Gibt denselben State zurück, wenn sich nichts ändert. */
export function mergeRemote(state: AppState, remote: ChangeSet, uploaded: ReadonlySet<string> = new Set()): AppState {
  let changed = false;

  const arcs = [...state.arcs];
  for (const row of remote.arcs) {
    const i = arcs.findIndex((a) => a.id === row.id);
    const incoming: Arc = { ...row.data, updatedAt: row.updated_at };
    if (i === -1) {
      arcs.push(incoming);
      changed = true;
    } else if (newer(row.updated_at, arcs[i].updatedAt ?? arcs[i].createdAt)) {
      arcs[i] = incoming;
      changed = true;
    }
  }

  const logs = { ...state.logs };
  for (const row of remote.entries) {
    const log = logs[row.arc_id] ?? {};
    const local = log[row.date];
    if (local && !newer(row.updated_at, local.updatedAt)) continue;
    // Fotos vom Server übernehmen; lokale, die noch nicht hochgeladen sind (oder nicht hochladbar), behalten.
    const keep = (local?.photos ?? []).filter((p) => !isSyncablePhoto(p) || !uploaded.has(p));
    const photos = row.photos === undefined ? local?.photos : [...new Set([...row.photos, ...keep])];
    const entry: DayEntry = {
      values: row.values ?? {},
      note: row.note ?? undefined,
      photos: photos?.length ? photos : undefined,
      updatedAt: row.updated_at,
    };
    logs[row.arc_id] = { ...log, [row.date]: entry };
    changed = true;
  }

  const reviews = { ...(state.reviews ?? {}) };
  for (const row of remote.reviews) {
    const byWeek = reviews[row.arc_id] ?? {};
    const local = byWeek[row.week];
    if (local && !newer(row.updated_at, local.updatedAt)) continue;
    reviews[row.arc_id] = { ...byWeek, [row.week]: { ...row.data, updatedAt: row.updated_at } };
    changed = true;
  }

  if (!changed) return state;

  // Aktiven Arc bestimmen, falls lokal keiner aktiv ist oder er inzwischen beendet wurde.
  let activeArcId = state.activeArcId;
  const current = arcs.find((a) => a.id === activeArcId);
  if (!current || current.status !== 'active') {
    const active = arcs.filter((a) => a.status === 'active').sort((a, b) => ts(b.createdAt).localeCompare(ts(a.createdAt)));
    activeArcId = active[0]?.id ?? null;
  }

  return { ...state, arcs, logs, reviews, activeArcId };
}
