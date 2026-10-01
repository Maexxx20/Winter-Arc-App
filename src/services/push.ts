import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getLang, onLangChange } from '@/i18n';
import { getState, subscribe, updateSettings } from '@/store/store';

import { getSession, onSession, supabase } from './supabase';

/** EAS-Projekt-ID aus app.json (wird mit `npx eas-cli@latest init` eingetragen). */
function projectId(): string | undefined {
  return (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
}

export type PushProblem = 'no-project' | 'simulator' | 'web' | 'denied' | 'signed-out' | 'failed';

export function pushProblemText(p: PushProblem): string {
  switch (p) {
    case 'no-project':
      return 'Die App ist noch nicht mit einem Expo-Projekt verbunden (npx eas-cli@latest init).';
    case 'simulator':
      return 'Push funktioniert nur auf einem echten Handy.';
    case 'web':
      return 'Push gibt es nur in der App.';
    case 'denied':
      return 'Erlaube Mitteilungen für Nordwand in den Einstellungen deines Handys.';
    case 'signed-out':
      return 'Melde dich zuerst an.';
    default:
      return 'Das hat nicht geklappt. Versuch es später nochmal.';
  }
}

let currentToken: string | null = null;

async function getToken(): Promise<{ token?: string; problem?: PushProblem }> {
  if (Platform.OS === 'web') return { problem: 'web' };
  if (!Device.isDevice) return { problem: 'simulator' };
  const id = projectId();
  if (!id) return { problem: 'no-project' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('crew', {
      name: 'Crew',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return { problem: 'denied' };
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  return { token: data };
}

/** Token beim Server hinterlegen. Gibt ein Problem zurück oder null. */
export async function registerPush(): Promise<PushProblem | null> {
  if (!supabase || !getSession()) return 'signed-out';
  try {
    const { token, problem } = await getToken();
    if (!token) return problem ?? 'failed';
    const platform = Platform.OS === 'android' ? 'android' : 'ios';
    // Mit Sprache (Migration 0010); fehlt die Funktion noch, ohne Sprache.
    let { error } = await supabase.rpc('claim_push_token', { p_token: token, p_platform: platform, p_lang: getLang() });
    if (error && /function|schema cache|p_lang/i.test(error.message)) {
      ({ error } = await supabase.rpc('claim_push_token', { p_token: token, p_platform: platform }));
    }
    if (error) return 'failed';
    currentToken = token;
    return null;
  } catch (e) {
    console.warn('Push-Registrierung fehlgeschlagen', e);
    return 'failed';
  }
}

/** Token vom Server entfernen (Ausschalten, Abmelden). */
export async function unregisterPush(): Promise<void> {
  if (!supabase || !getSession()) return;
  try {
    const token = currentToken ?? (await getToken()).token;
    if (token) await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // egal – ohne Token kommt eh nichts an
  }
  currentToken = null;
}

/** Schalter in den Einstellungen. */
export async function setCrewPush(on: boolean): Promise<PushProblem | null> {
  if (!on) {
    updateSettings({ crewPush: false });
    await unregisterPush();
    return null;
  }
  const problem = await registerPush();
  updateSettings({ crewPush: !problem });
  return problem;
}

/** Im Root-Layout: nach dem Anmelden und beim Start das Token auffrischen (es kann sich ändern). */
export function usePushRegistration() {
  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const refresh = () => {
      if (getSession() && getState().settings.crewPush) registerPush().catch(() => undefined);
    };
    const timer = setTimeout(refresh, 2500);
    const off = onSession((s) => s && refresh());
    // Einmal nach dem Laden des Speichers, falls die Einstellung erst dann bekannt ist.
    let checked = false;
    const unsub = subscribe(() => {
      if (checked) return;
      checked = true;
      refresh();
    });
    // Sprache gewechselt → Mitteilungen in der neuen Sprache
    const offLang = onLangChange(refresh);
    return () => {
      clearTimeout(timer);
      off();
      unsub();
      offLang();
    };
  }, []);
}
