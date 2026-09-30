/**
 * Lokaler App-Zustand (offline-first), persistiert in AsyncStorage.
 * Das Format ist so gewählt, dass es später 1:1 mit Supabase synchronisiert
 * werden kann (UUIDs, ISO-Daten, Einträge pro Tag).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { uid } from '@/lib/arc';
import { deletePhoto } from '@/services/photos';
import { addDays, type ISODate } from '@/lib/date';
import { type ChangeSet, mergeRemote } from '@/lib/sync-merge';
import type { AppState, Arc, Avatar, DayEntry, ReminderSettings, Rule, Settings, SyncMeta, WeekReview } from '@/lib/types';

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

function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  emit();
  persist();
}

export async function hydrate(): Promise<void> {
  if (hydrated) return;
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
  } catch (e) {
    console.warn('Laden fehlgeschlagen', e);
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
  rules: Omit<Rule, 'id' | 'activeFrom'>[];
  signatureName: string;
}

export const DEFAULT_AMENDMENTS = 3;

export function createArc(draft: ArcDraft): Arc {
  const arc: Arc = {
    id: uid(),
    title: draft.title.trim() || 'Winter Arc',
    startDate: draft.startDate,
    endDate: draft.endDate,
    why: draft.why.trim(),
    rules: draft.rules.map((r) => ({ ...r, id: uid(), activeFrom: draft.startDate })),
    signature: { name: draft.signatureName.trim(), signedAt: new Date().toISOString() },
    amendmentsLeft: DEFAULT_AMENDMENTS,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  setState((s) => ({
    ...s,
    arcs: [...s.arcs.map((a) => (a.id === s.activeArcId && a.status === 'active' ? { ...a, status: 'abandoned' as const, updatedAt: now() } : a)), arc],
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

export function abandonActiveArc() {
  setState((s) => ({
    ...s,
    arcs: s.arcs.map((a) => (a.id === s.activeArcId ? { ...a, status: 'abandoned' as const, updatedAt: now() } : a)),
    activeArcId: null,
  }));
}

/** Server-Daten übernehmen (ohne updatedAt zu verändern). */
export function applyRemote(remote: ChangeSet) {
  const uploaded = new Set(state.sync?.uploadedPhotos ?? []);
  const next = mergeRemote(state, remote, uploaded);
  if (next === state) return;
  // Auf einem anderen Gerät gelöschte Fotos auch hier entfernen.
  const before = new Set(Object.values(state.logs).flatMap((l) => Object.values(l).flatMap((e) => e.photos ?? [])));
  const after = new Set(Object.values(next.logs).flatMap((l) => Object.values(l).flatMap((e) => e.photos ?? [])));
  const gone = [...before].filter((p) => !after.has(p));
  gone.forEach(deletePhoto);
  // Fotos, die der Server nennt, liegen dort schon – auch wenn ein anderes Gerät sie hochgeladen hat.
  if (state.sync) {
    const onServer = new Set([...uploaded, ...remote.entries.flatMap((r) => r.photos ?? [])]);
    gone.forEach((p) => onServer.delete(p));
    next.sync = { ...state.sync, uploadedPhotos: [...onServer].filter((p) => after.has(p)) };
  }
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

export function addPhoto(arcId: string, date: ISODate, uri: string) {
  updateEntry(arcId, date, (e) => ({ ...e, photos: [...(e.photos ?? []), uri] }));
}

export function removePhoto(arcId: string, date: ISODate, uri: string) {
  updateEntry(arcId, date, (e) => {
    const photos = (e.photos ?? []).filter((p) => p !== uri);
    return { ...e, photos: photos.length ? photos : undefined };
  });
  // War es schon hochgeladen, beim nächsten Abgleich auch auf dem Server löschen.
  const meta = state.sync;
  if (meta?.uploadedPhotos?.includes(uri)) {
    setSyncMeta({
      uploadedPhotos: meta.uploadedPhotos.filter((p) => p !== uri),
      photoDeletes: [...(meta.photoDeletes ?? []), uri],
    });
  }
}

/** Nach dem Hochladen bzw. Löschen auf dem Server. */
export function markPhotosSynced(uploaded: string[], deleted: string[]) {
  const meta = state.sync;
  if (!meta) return;
  const up = new Set(meta.uploadedPhotos ?? []);
  uploaded.forEach((p) => up.add(p));
  const del = new Set(deleted);
  setSyncMeta({ uploadedPhotos: [...up], photoDeletes: (meta.photoDeletes ?? []).filter((p) => !del.has(p)) });
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
