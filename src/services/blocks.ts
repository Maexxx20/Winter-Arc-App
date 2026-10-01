/**
 * Blockierte Personen (Migration 0009). Blockieren wirkt in beide Richtungen: keine
 * Reaktionen, keine Mitteilungen, kein Profil und kein Tagesstatus mehr voneinander.
 */
import { useSyncExternalStore } from 'react';

import { t } from '@/i18n';

import { getSession, onSession, supabase } from './supabase';

export interface BlockedPerson {
  blocked: string;
  name: string;
  created_at: string;
}

let list: BlockedPerson[] = [];
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setList(next: BlockedPerson[]) {
  list = next;
  emit();
}

onSession((s) => {
  if (!s) {
    loadedFor = null;
    setList([]);
  }
});

/** Liste vom Server holen (einmal pro Anmeldung, ausser `force`). */
export async function loadBlocks(force = false): Promise<BlockedPerson[]> {
  const session = getSession();
  if (!supabase || !session) return [];
  if (!force && loadedFor === session.user.id) return list;
  const { data, error } = await supabase.from('user_blocks').select('blocked, name, created_at').order('created_at', { ascending: false });
  if (error) return list; // Migration 0009 fehlt
  loadedFor = session.user.id;
  setList((data ?? []) as BlockedPerson[]);
  return list;
}

export async function blockUser(userId: string, name: string): Promise<void> {
  if (!supabase || !getSession()) throw new Error(t('common.signInFirst'));
  const { error } = await supabase
    .from('user_blocks')
    .upsert({ blocker: getSession()!.user.id, blocked: userId, name: name.slice(0, 40) }, { onConflict: 'blocker,blocked' });
  if (error) throw new Error(/user_blocks|schema cache/.test(error.message) ? t('crewx.errors.needsUpdate') : error.message);
  setList([{ blocked: userId, name, created_at: new Date().toISOString() }, ...list.filter((b) => b.blocked !== userId)]);
}

export async function unblockUser(userId: string): Promise<void> {
  if (!supabase || !getSession()) throw new Error(t('common.signInFirst'));
  const { error } = await supabase.from('user_blocks').delete().eq('blocked', userId);
  if (error) throw new Error(error.message);
  setList(list.filter((b) => b.blocked !== userId));
}

export function isBlocked(userId: string): boolean {
  return list.some((b) => b.blocked === userId);
}

export function useBlocks(): BlockedPerson[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => list,
    () => list,
  );
}
