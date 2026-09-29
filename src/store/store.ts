/**
 * Lokaler App-Zustand (offline-first), persistiert in AsyncStorage.
 * Das Format ist so gewählt, dass es später 1:1 mit Supabase synchronisiert
 * werden kann (UUIDs, ISO-Daten, Einträge pro Tag).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { uid } from '@/lib/arc';
import { addDays, type ISODate } from '@/lib/date';
import type { AppState, Arc, DayEntry, Rule, Settings } from '@/lib/types';

const STORAGE_KEY = 'arc.state.v1';

const initialState: AppState = {
  schemaVersion: 1,
  arcs: [],
  activeArcId: null,
  logs: {},
  settings: { name: '', rolloverHour: 0, haptics: true },
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
        state = { ...initialState, ...parsed, settings: { ...initialState.settings, ...parsed.settings } };
      }
    }
  } catch (e) {
    console.warn('Laden fehlgeschlagen', e);
  }
  hydrated = true;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => hydrated, () => hydrated);
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
  };
  setState((s) => ({
    ...s,
    arcs: [...s.arcs.map((a) => (a.id === s.activeArcId && a.status === 'active' ? { ...a, status: 'abandoned' as const } : a)), arc],
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
        ? { ...a, rules, amendmentsLeft: beforeStart ? a.amendmentsLeft : a.amendmentsLeft - 1 }
        : a,
    ),
  }));
  return true;
}

export function updateArcMeta(arcId: string, patch: Partial<Pick<Arc, 'title' | 'why'>>) {
  setState((s) => ({ ...s, arcs: s.arcs.map((a) => (a.id === arcId ? { ...a, ...patch } : a)) }));
}

export function abandonActiveArc() {
  setState((s) => ({
    ...s,
    arcs: s.arcs.map((a) => (a.id === s.activeArcId ? { ...a, status: 'abandoned' as const } : a)),
    activeArcId: null,
  }));
}

export async function resetAll() {
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
