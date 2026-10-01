/**
 * Lokaler App-Zustand (offline-first), persistiert in AsyncStorage.
 * Das Format ist so gewählt, dass es später 1:1 mit Supabase synchronisiert
 * werden kann (UUIDs, ISO-Daten, Einträge pro Tag).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { uid } from '@/lib/arc';
import { deletePhoto } from '@/services/photos';
import { addDays, type ISODate, toISO, todayISO } from '@/lib/date';
import { isSyncablePhoto, mergePhotoRows, type PhotoRow, withLegacyPhotoRecords } from '@/lib/photo-merge';
import { type ChangeSet, mergeRemote } from '@/lib/sync-merge';
import type { AppState, Arc, ArcCrewLink, Avatar, DayEntry, HealthLink, ReminderSettings, Rule, Settings, SyncMeta, TimeOfDay, WeekReview } from '@/lib/types';

const STORAGE_KEY = 'arc.state.v1';

const now = () => new Date().toISOString();

const initialState: AppState = {
  schemaVersion: 1,
  arcs: [],
  activeArcId: null,
  logs: {},
  reviews: {},
  settings: {
    name: '',
    motto: '',
    instagram: '',
    avatar: { local: null, remote: null },
    profileUpdatedAt: null,
    seenBadges: null,
    crewPush: null,
    rolloverHour: 0,
    haptics: true,
    reminders: { enabled: null, morning: 7 * 60 + 30, evening: 20 * 60 + 30, weeklyReview: true },
  },
};

let state: AppState = initialState;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((e) =>
      console.warn('Speichern fehlgeschlagen', e),
    );
  }, 150);
}

/** Sofort speichern (z. B. im Android-Widget, das danach beendet wird). */
export async function flushState(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  emit();
  persist();
}

/** `beforeShow` läuft nach dem Laden, aber bevor die App gezeigt wird (z. B. Sprache setzen). */
let hydrating: Promise<void> | null = null;

/** Lädt nur einmal, auch wenn App und Android-Widget gleichzeitig starten. */
export function hydrate(beforeShow?: () => void): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (!hydrating) hydrating = doHydrate(beforeShow);
  return hydrating;
}

async function doHydrate(beforeShow?: () => void): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed?.schemaVersion === 1) {
        state = {
          ...initialState,
          ...parsed,
          reviews: parsed.reviews ?? {},
          settings: {
            ...initialState.settings,
            ...parsed.settings,
            reminders: { ...initialState.settings.reminders, ...parsed.settings?.reminders },
            avatar: { ...initialState.settings.avatar, ...parsed.settings?.avatar },
          },
        };
      }
    }
    // Fotos aus älteren Versionen bekommen einen Sync-Datensatz.
    state = withLegacyPhotoRecords(state);
  } catch (e) {
    console.warn('Laden fehlgeschlagen', e);
  }
  try {
    beforeShow?.();
  } catch (e) {
    console.warn(e);
  }
  hydrated = true;
  emit();
}

/** Für Nebeneffekte ausserhalb von React (Erinnerungen, Sync). */
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => hydrated, () => hydrated);
}

export function isHydrated(): boolean {
  return hydrated;
}

export function getState(): AppState {
  return state;
}

// ---------- Selektoren ----------

export function selectActiveArc(s: AppState): Arc | null {
  return s.arcs.find((a) => a.id === s.activeArcId) ?? null;
}

export function selectLog(s: AppState, arcId: string | undefined) {
  return (arcId && s.logs[arcId]) || {};
}

// ---------- Aktionen ----------

export interface ArcDraft {
  title: string;
  startDate: ISODate;
  endDate: ISODate;
  why: string;
  /** Regeln; bei Crew-Arcs mit fester ID (gleich wie in der Crew) */
  rules: (Omit<Rule, 'id' | 'activeFrom'> & { id?: string })[];
  signatureName: string;
  crew?: ArcCrewLink;
}

export const DEFAULT_AMENDMENTS = 3;

export function createArc(draft: ArcDraft): Arc {
  const arc: Arc = {
    id: uid(),
    title: draft.title.trim() || 'Winter Arc',
    startDate: draft.startDate,
    endDate: draft.endDate,
    why: draft.why.trim(),
    rules: draft.rules.map((r) => ({ ...r, id: draft.crew && r.id ? r.id : uid(), activeFrom: draft.startDate })),
    signature: { name: draft.signatureName.trim(), signedAt: new Date().toISOString() },
    amendmentsLeft: DEFAULT_AMENDMENTS,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Aus einer Crew-Vorlage: wie ein eigener Arc änderbar, die Verbindung dient nur dem Vergleich
    ...(draft.crew ? { crew: draft.crew } : {}),
  };
  setState((s) => ({
    ...s,
    // Ein laufender Arc wird abgebrochen, ein abgelaufener gilt als beendet.
    arcs: [
      ...s.arcs.map((a) =>
        a.id === s.activeArcId && a.status === 'active'
          ? { ...a, status: a.endDate < todayISO(new Date(), s.settings.rolloverHour) ? ('finished' as const) : ('abandoned' as const), updatedAt: now() }
          : a,
      ),
      arc,
    ],
    activeArcId: arc.id,
    logs: { ...s.logs, [arc.id]: {} },
    settings: { ...s.settings, name: s.settings.name || draft.signatureName.trim() },
  }));
  return arc;
}

function updateEntry(arcId: string, date: ISODate, fn: (e: DayEntry) => DayEntry) {
  setState((s) => {
    const log = s.logs[arcId] ?? {};
    const prev: DayEntry = log[date] ?? { values: {}, updatedAt: '' };
    const next = { ...fn(prev), updatedAt: new Date().toISOString() };
    return { ...s, logs: { ...s.logs, [arcId]: { ...log, [date]: next } } };
  });
}

export function setRuleValue(arcId: string, date: ISODate, ruleId: string, value: number) {
  updateEntry(arcId, date, (e) => {
    const values = { ...e.values };
    if (value > 0) values[ruleId] = value;
    else delete values[ruleId];
    return { ...e, values };
  });
}

/** Wert aus Health/Strava eintragen und merken (damit eine Änderung von Hand danach bestehen bleibt). */
export function setHealthValue(arcId: string, date: ISODate, ruleId: string, value: number) {
  setRuleValue(arcId, date, ruleId, value);
  const cutoff = addDays(toISO(new Date()), -10);
  setState((s) => {
    const auto: Record<string, number> = {};
    for (const [k, v] of Object.entries(s.healthAuto ?? {})) if ((k.split('|')[1] ?? '') >= cutoff) auto[k] = v;
    auto[`${arcId}|${date}|${ruleId}`] = value;
    return { ...s, healthAuto: auto };
  });
}

/** Crew-Arc verlassen: der Arc läuft als eigener Arc weiter. */
export function unlinkCrewArc(crewArcId: string) {
  setState((s) => ({
    ...s,
    arcs: s.arcs.map((a) => (a.crew?.crewArcId === crewArcId ? { ...a, crew: undefined, updatedAt: now() } : a)),
  }));
}

export function setNote(arcId: string, date: ISODate, note: string) {
  updateEntry(arcId, date, (e) => ({ ...e, note: note.trim() ? note : undefined }));
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

// ---------- Profil ----------

export type ProfilePatch = Partial<Pick<Settings, 'name' | 'motto' | 'instagram'>>;

/** Eigenes Profil ändern (wird beim nächsten Sync hochgeladen). */
export function updateProfile(patch: ProfilePatch) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch, profileUpdatedAt: now() } }));
}

/** Neues Profilbild (lokale Datei) setzen oder mit null entfernen. */
export function setAvatar(local: string | null) {
  const old = state.settings.avatar.local;
  if (old && old !== local) deletePhoto(old);
  setState((s) => ({ ...s, settings: { ...s.settings, avatar: { local, remote: null }, profileUpdatedAt: now() } }));
}

/**
 * Nach dem Hochladen: Serverpfad merken, ohne das Profil als geändert zu markieren.
 * Nur wenn inzwischen kein anderes Bild gewählt oder das Bild entfernt wurde.
 */
export function setAvatarRemote(uploadedLocal: string, remote: string): boolean {
  if (state.settings.avatar.local !== uploadedLocal) return false;
  state = { ...state, settings: { ...state.settings, avatar: { local: uploadedLocal, remote } } };
  emit();
  persist();
  return true;
}

/** Beim Konto-Wechsel oder Abmelden: Server-Stand des Profils vergessen (Inhalt bleibt). */
export function resetProfileSync() {
  state = {
    ...state,
    settings: { ...state.settings, profileUpdatedAt: null, avatar: { local: state.settings.avatar.local, remote: null } },
  };
  emit();
  persist();
}

export interface RemoteProfile {
  name: string;
  motto: string;
  instagram: string;
  avatar_path: string | null;
  updated_at: string;
}

/** Profil vom Server übernehmen (neuere Version von einem anderen Gerät). */
export function applyRemoteProfile(p: RemoteProfile) {
  const cur = state.settings;
  let avatar: Avatar = cur.avatar;
  if (p.avatar_path !== cur.avatar.remote) {
    if (cur.avatar.local) deletePhoto(cur.avatar.local);
    avatar = { local: null, remote: p.avatar_path };
  }
  state = {
    ...state,
    settings: {
      ...cur,
      name: p.name || cur.name,
      motto: p.motto,
      instagram: p.instagram,
      avatar,
      profileUpdatedAt: p.updated_at,
    },
  };
  emit();
  persist();
}

/** Profil als geändert markieren, ohne Inhalt zu ändern (erster Upload). */
export function touchProfile() {
  state = { ...state, settings: { ...state.settings, profileUpdatedAt: now() } };
  persist();
}

/** Abzeichen als gesehen markieren (keine Feier mehr). */
export function markBadgesSeen(keys: string[]) {
  const seen = new Set(state.settings.seenBadges ?? []);
  const before = seen.size;
  keys.forEach((k) => seen.add(k));
  if (seen.size === before && state.settings.seenBadges) return;
  setState((s) => ({ ...s, settings: { ...s.settings, seenBadges: [...seen] } }));
}

/**
 * Vertragsänderung: Regeln hinzufügen/entfernen.
 * Vor dem Start frei, danach kostet jede Änderung ein Amendment.
 * Änderungen gelten ab heute; vergangene Tage bleiben unverändert bewertet.
 */
export function amendRules(
  arcId: string,
  change: { add?: Omit<Rule, 'id' | 'activeFrom'>[]; removeIds?: string[] },
  today: ISODate,
): boolean {
  const arc = state.arcs.find((a) => a.id === arcId);
  if (!arc) return false;
  const beforeStart = today < arc.startDate;
  if (!beforeStart && arc.amendmentsLeft <= 0) return false;

  const effective = beforeStart ? arc.startDate : today;
  let rules = arc.rules.map((r) => {
    if (!change.removeIds?.includes(r.id)) return r;
    return { ...r, removedOn: effective };
  });
  // Regeln, die vor ihrem ersten Tag entfernt wurden, ganz löschen.
  rules = rules.filter((r) => !r.removedOn || r.removedOn > r.activeFrom);
  for (const add of change.add ?? []) rules.push({ ...add, id: uid(), activeFrom: effective });

  setState((s) => ({
    ...s,
    arcs: s.arcs.map((a) =>
      a.id === arcId
        ? { ...a, rules, amendmentsLeft: beforeStart ? a.amendmentsLeft : a.amendmentsLeft - 1, updatedAt: now() }
        : a,
    ),
  }));
  return true;
}

export function updateArcMeta(arcId: string, patch: Partial<Pick<Arc, 'title' | 'why'>>) {
  setState((s) => ({ ...s, arcs: s.arcs.map((a) => (a.id === arcId ? { ...a, ...patch, updatedAt: now() } : a)) }));
}

/** Regel mit Health verknüpfen oder lösen. Kostet keine Vertragsänderung – die Regel bleibt dieselbe. */
/** Persönliche Erinnerung einer Regel (keine Vertragsänderung). */
export function setRuleReminder(arcId: string, ruleId: string, time: TimeOfDay | null) {
  setState((s) => ({
    ...s,
    arcs: s.arcs.map((a) =>
      a.id === arcId
        ? {
            ...a,
            rules: a.rules.map((r) => {
              if (r.id !== ruleId) return r;
              const { reminder: _old, ...rest } = r;
              return time === null ? rest : { ...rest, reminder: time };
            }),
            updatedAt: now(),
          }
        : a,
    ),
  }));
}

export function setRuleHealth(arcId: string, ruleId: string, link: HealthLink | null) {
  setState((s) => ({
    ...s,
    arcs: s.arcs.map((a) =>
      a.id === arcId
        ? {
            ...a,
            rules: a.rules.map((r) => {
              if (r.id !== ruleId) return r;
              const { health: _old, ...rest } = r;
              return link ? { ...rest, health: link } : rest;
            }),
            updatedAt: now(),
          }
        : a,
    ),
  }));
}

/** Arc ist vorbei: als beendet ablegen (bleibt im Verlauf). */
export function finishActiveArc() {
  setState((s) => ({
    ...s,
    arcs: s.arcs.map((a) => (a.id === s.activeArcId ? { ...a, status: 'finished' as const, updatedAt: now() } : a)),
    activeArcId: null,
  }));
}

export function abandonActiveArc() {
  setState((s) => ({
    ...s,
    arcs: s.arcs.map((a) => (a.id === s.activeArcId ? { ...a, status: 'abandoned' as const, updatedAt: now() } : a)),
    activeArcId: null,
  }));
}

/** Server-Daten übernehmen (ohne updatedAt zu verändern). */
export function applyRemote(remote: ChangeSet) {
  const next = mergeRemote(state, remote);
  if (next === state) return;
  state = next;
  emit();
  persist();
}

/** Foto-Datensätze vom Server übernehmen; gelöschte Fotos auch hier entfernen. */
export function applyRemotePhotos(rows: PhotoRow[]) {
  const { state: next, removed } = mergePhotoRows(state, rows);
  if (next === state) return;
  removed.forEach(deletePhoto);
  state = next;
  emit();
  persist();
}

export function setSyncMeta(patch: Partial<SyncMeta>) {
  const current: SyncMeta = state.sync ?? { lastPushedAt: null, lastPulledAt: null, userId: null };
  state = { ...state, sync: { ...current, ...patch } };
  persist(); // kein emit – ändert nichts an der Oberfläche
}

export function updateReminders(patch: Partial<ReminderSettings>) {
  setState((s) => ({
    ...s,
    settings: { ...s.settings, reminders: { ...s.settings.reminders, ...patch } },
  }));
}

function setPhotoRecord(name: string, arcId: string, date: ISODate, deleted: boolean) {
  if (!isSyncablePhoto(name)) return;
  state = {
    ...state,
    photoLog: { ...(state.photoLog ?? {}), [name]: { arcId, date, deleted, updatedAt: now() } },
  };
}

export function addPhoto(arcId: string, date: ISODate, uri: string) {
  setPhotoRecord(uri, arcId, date, false);
  updateEntry(arcId, date, (e) => ({ ...e, photos: [...(e.photos ?? []), uri] }));
}

export function removePhoto(arcId: string, date: ISODate, uri: string) {
  // Löschmarke: gilt beim nächsten Abgleich für alle Geräte und das Konto.
  setPhotoRecord(uri, arcId, date, true);
  updateEntry(arcId, date, (e) => {
    const photos = (e.photos ?? []).filter((p) => p !== uri);
    return { ...e, photos: photos.length ? photos : undefined };
  });
}

/** Datei liegt im Konto. */
export function markPhotoUploaded(name: string) {
  const meta = state.sync;
  if (!meta || meta.uploadedPhotos?.includes(name)) return;
  setSyncMeta({ uploadedPhotos: [...(meta.uploadedPhotos ?? []), name] });
}

export function saveReview(arcId: string, week: ISODate, review: Omit<WeekReview, 'updatedAt'>) {
  setState((s) => ({
    ...s,
    reviews: {
      ...s.reviews,
      [arcId]: { ...(s.reviews[arcId] ?? {}), [week]: { ...review, updatedAt: now() } },
    },
  }));
}

export function selectReviews(s: AppState, arcId: string | undefined) {
  return (arcId && s.reviews[arcId]) || {};
}

export async function resetAll() {
  for (const log of Object.values(state.logs)) {
    for (const e of Object.values(log)) for (const p of e.photos ?? []) deletePhoto(p);
  }
  if (state.settings.avatar.local) deletePhoto(state.settings.avatar.local);
  state = initialState;
  emit();
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Nur für Entwicklung/Screenshots: füllt die letzten Tage mit Beispieldaten. */
export function seedDemo(arcId: string, today: ISODate, days = 20) {
  const arc = state.arcs.find((a) => a.id === arcId);
  if (!arc) return;
  setState((s) => {
    const log = { ...(s.logs[arcId] ?? {}) };
    for (let i = days; i >= 1; i--) {
      const d = addDays(today, -i);
      if (d < arc.startDate) continue;
      const values: Record<string, number> = {};
      for (const r of arc.rules) {
        const skip = (i === 6 || i === 13) ? true : Math.random() < 0.12;
        if (skip) continue;
        values[r.id] = r.measure.kind === 'amount' ? r.measure.target : 1;
      }
      log[d] = { values, updatedAt: new Date().toISOString() };
    }
    return { ...s, logs: { ...s.logs, [arcId]: log } };
  });
}
