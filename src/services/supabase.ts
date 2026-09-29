import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';

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

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    currentSession = data.session;
    sessionListeners.forEach((l) => l(currentSession));
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    sessionListeners.forEach((l) => l(session));
  });
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
  if (!supabase) return 'Sync ist noch nicht eingerichtet.';
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  return error ? translateAuthError(error.message) : null;
}

export async function verifyLoginCode(email: string, token: string): Promise<string | null> {
  if (!supabase) return 'Sync ist noch nicht eingerichtet.';
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: 'email' });
  return error ? translateAuthError(error.message) : null;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('expired') || m.includes('invalid')) return 'Der Code ist falsch oder abgelaufen.';
  if (m.includes('rate') || m.includes('seconds')) return 'Zu viele Versuche. Warte kurz und versuch es nochmal.';
  if (m.includes('email')) return 'Diese E-Mail-Adresse ist ungültig.';
  if (m.includes('network') || m.includes('fetch')) return 'Keine Verbindung. Bist du online?';
  return msg;
}
