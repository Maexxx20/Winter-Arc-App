import { useEffect, useSyncExternalStore } from 'react';
import { AppState as RNAppState } from 'react-native';

import { type ArcRow, collectChanges, type ChangeSet, type EntryRow, type ReviewRow } from '@/lib/sync-merge';
import { applyRemote, getState, isHydrated, resetProfileSync, setSyncMeta, subscribe } from '@/store/store';

import { publishStatus } from './crews';
import { removeAllPhotos, syncPhotos } from './photo-sync';
import { removeAvatars, syncProfile } from './profile';
import { unregisterPush } from './push';
import { getSession, onSession, signOut, supabase } from './supabase';

// ---------- Status für die Oberfläche ----------

export type SyncStatus = { state: 'off' | 'idle' | 'syncing' | 'error'; lastSyncAt: Date | null; error: string | null };
let status: SyncStatus = { state: 'off', lastSyncAt: null, error: null };
const statusListeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => status,
    () => status,
  );
}

// ---------- Abgleich ----------

const CHUNK = 500;

async function upsert(table: string, rows: object[], onConflict: string) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase!.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function pullTable<T>(table: string, since: string | null): Promise<(T & { server_updated_at: string })[]> {
  const out: (T & { server_updated_at: string })[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = supabase!.from(table).select('*').order('server_updated_at', { ascending: true }).range(from, from + PAGE - 1);
    if (since) q = q.gt('server_updated_at', since);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as (T & { server_updated_at: string })[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = doSync().finally(() => {
    running = null;
    if (again) {
      again = false;
      syncNow();
    }
  });
  return running;
}

async function doSync() {
  const session = getSession();
  if (!supabase || !session || !isHydrated()) return;
  const userId = session.user.id;
  setStatus({ state: 'syncing', error: null });

  try {
    let meta = getState().sync;
    if (!meta || meta.userId !== userId) {
      // Anderes oder neues Konto: alles hochladen und alles holen.
      setSyncMeta({ userId, lastPushedAt: null, lastPulledAt: null, uploadedPhotos: [], photosPushedAt: null, photosPulledAt: null });
      resetProfileSync();
      meta = getState().sync!;
    }

    // 1) Hochladen
    const pushStart = new Date().toISOString();
    const changes = collectChanges(getState(), meta.lastPushedAt);
    await upsert('arcs', changes.arcs.map((a) => ({ ...a, user_id: userId })), 'id');
    await upsert('day_entries', changes.entries.map((e) => ({ ...e, user_id: userId })), 'arc_id,date');
    await upsert('week_reviews', changes.reviews.map((r) => ({ ...r, user_id: userId })), 'arc_id,week');
    setSyncMeta({ lastPushedAt: pushStart });

    // 2) Herunterladen
    const since = meta.lastPulledAt;
    const [arcs, entries, reviews] = await Promise.all([
      pullTable<ArcRow>('arcs', since),
      pullTable<EntryRow>('day_entries', since),
      pullTable<ReviewRow>('week_reviews', since),
    ]);
    const remote: ChangeSet = { arcs, entries, reviews };
    applyRemote(remote);

    const newest = [...arcs, ...entries, ...reviews].map((r) => r.server_updated_at).sort().pop();
    if (newest) setSyncMeta({ lastPulledAt: newest });

    // 3) Tages-Zusammenfassung für Crews (nur Zahlen, keine Inhalte)
    await publishStatus();

    // 4) Profil und Fotos – eigene Fehler, damit sie den restlichen Abgleich nicht blockieren.
    const problems: string[] = [];
    try {
      await syncProfile(userId);
    } catch (e) {
      console.warn('Profil-Abgleich fehlgeschlagen', e);
      problems.push(`Profil: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await syncPhotos(userId);
    } catch (e) {
      console.warn('Foto-Abgleich fehlgeschlagen', e);
      problems.push(e instanceof Error ? e.message : String(e));
    }
    if (problems.length) {
      setStatus({ state: 'error', lastSyncAt: new Date(), error: problems.join(' · ') });
      return;
    }

    setStatus({ state: 'idle', lastSyncAt: new Date() });
  } catch (e) {
    console.warn('Sync fehlgeschlagen', e);
    setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

/** Löscht alle Arcs des Kontos auf dem Server (Einträge folgen per Cascade). */
export async function deleteRemoteData(): Promise<void> {
  const session = getSession();
  if (!supabase || !session) return;
  await removeAllPhotos(session.user.id); // zuerst: wirft, falls das nicht klappt
  const { error } = await supabase.from('arcs').delete().eq('user_id', session.user.id);
  if (error) throw new Error(error.message);
  setSyncMeta({ uploadedPhotos: [], photosPushedAt: null, photosPulledAt: null });
}

/** Vor dem Abmelden noch hochladen; lokale Daten bleiben auf dem Gerät. */
export async function logout(): Promise<void> {
  await syncNow().catch(() => undefined);
  await unregisterPush();
  await signOut();
  setSyncMeta({ userId: null, lastPushedAt: null, lastPulledAt: null, uploadedPhotos: [], photosPushedAt: null, photosPulledAt: null });
  resetProfileSync();
}

/** Löscht das Konto samt allen Daten auf dem Server. */
export async function deleteAccount(): Promise<string | null> {
  if (!supabase) return null;
  const session = getSession();
  if (session) {
    // Dateien liegen im Speicher, nicht in der Datenbank – vorher löschen, sonst bleiben sie für immer.
    try {
      await removeAvatars(session.user.id);
      await removeAllPhotos(session.user.id);
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }
  const { error } = await supabase.rpc('delete_account');
  if (error) return error.message;
  await supabase.auth.signOut();
  setSyncMeta({ userId: null, lastPushedAt: null, lastPulledAt: null, uploadedPhotos: [], photosPushedAt: null, photosPulledAt: null });
  resetProfileSync();
  return null;
}

/** Im Root-Layout: gleicht nach Anmeldung, beim Öffnen und nach Änderungen ab. */
export function useSyncLoop() {
  useEffect(() => {
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = (ms: number) => {
      if (!getSession()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => syncNow(), ms);
    };
    const offSession = onSession((s) => {
      if (s) later(300);
      else setStatus({ state: 'off' });
    });
    later(1000);
    const unsub = subscribe(() => later(4000));
    const appSub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') later(500);
      else if (getSession()) syncNow(); // vor dem Schliessen noch hochladen
    });
    return () => {
      if (timer) clearTimeout(timer);
      offSession();
      unsub();
      appSub.remove();
    };
  }, []);
}
