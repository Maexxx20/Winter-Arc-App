import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';

import { getLang, onLangChange, t } from '@/i18n';

/**
 * Supabase-Zugang. URL und anon-Key kommen aus `.env.local`
 * (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
 * Ohne diese Werte läuft die App rein lokal weiter.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const supabaseConfigured = supabase !== null;

// Token nur auffrischen, solange die App im Vordergrund ist (Empfehlung für React Native).
if (supabase && Platform.OS !== 'web') {
  RNAppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

let currentSession: Session | null = null;
const sessionListeners = new Set<(s: Session | null) => void>();

/**
 * Sprache im Konto vermerken (user_metadata.lang), damit die Mail mit dem Anmeldecode
 * in der richtigen Sprache kommt (Vorlage in docs/SUPABASE.md, 2a).
 * Nicht direkt im Auth-Callback aufrufen – Supabase empfiehlt, dort nichts abzuwarten.
 */
function syncAuthLanguage() {
  const s = currentSession;
  if (!supabase || !s) return;
  const lang = getLang();
  if ((s.user.user_metadata as { lang?: string } | undefined)?.lang === lang) return;
  setTimeout(() => {
    supabase?.auth.updateUser({ data: { lang } }).catch(() => undefined);
  }, 0);
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    currentSession = data.session;
    sessionListeners.forEach((l) => l(currentSession));
    syncAuthLanguage();
  });
  supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    sessionListeners.forEach((l) => l(session));
    if (event === 'SIGNED_IN') syncAuthLanguage();
  });
  onLangChange(syncAuthLanguage);
}

export function getSession(): Session | null {
  return currentSession;
}

export function onSession(l: (s: Session | null) => void): () => void {
  sessionListeners.add(l);
  return () => sessionListeners.delete(l);
}

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(currentSession);
  useEffect(() => {
    setSession(currentSession);
    return onSession(setSession);
  }, []);
  return session;
}

// ---------- Anmeldung mit E-Mail-Code ----------

export async function sendLoginCode(email: string): Promise<string | null> {
  if (!supabase) return t('system.auth.notConfigured');
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    // Sprache für die Code-Mail (bei neuen Konten; bestehende bekommen sie nach der Anmeldung)
    options: { shouldCreateUser: true, data: { lang: getLang() } },
  });
  return error ? translateAuthError(error.message) : null;
}

export async function verifyLoginCode(email: string, token: string): Promise<string | null> {
  if (!supabase) return t('system.auth.notConfigured');
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: 'email' });
  return error ? translateAuthError(error.message) : null;
}

/**
 * Zugang für die App-Review von Apple/Google: Diese eine Adresse meldet sich mit
 * Passwort an (das Review-Team kann keine E-Mail-Codes empfangen).
 */
export const REVIEW_EMAIL = (process.env.EXPO_PUBLIC_REVIEW_EMAIL ?? '').trim().toLowerCase();

export function isReviewEmail(email: string): boolean {
  return !!REVIEW_EMAIL && email.trim().toLowerCase() === REVIEW_EMAIL;
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  if (!supabase) return t('system.auth.notConfigured');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return error ? translateAuthError(error.message) : null;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('timed out') || m.includes('timeout') || m.includes('error sending') || m.includes('smtp'))
    return t('system.auth.mailFailed');
  if (m.includes('credentials')) return t('system.auth.wrongPassword');
  if (m.includes('expired') || m.includes('invalid')) return t('system.auth.wrongCode');
  if (m.includes('rate') || m.includes('seconds')) return t('system.auth.tooMany');
  if (m.includes('email')) return t('system.auth.invalidEmail');
  if (m.includes('network') || m.includes('fetch')) return t('common.offline');
  return msg;
}
