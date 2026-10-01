import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import { addDays, type ISODate, parseISO } from '@/lib/date';
import { getState, updateSettings } from '@/store/store';

import { getSession, supabase } from './supabase';

/**
 * Strava über die Edge Function «strava» (das Client-Secret bleibt auf dem Server).
 * Der Rücksprung in die App läuft über nordwand://localhost/strava – in den Strava-API-Einstellungen
 * muss die «Authorization Callback Domain» deshalb «localhost» sein.
 */
const REDIRECT = `${String(Constants.expoConfig?.scheme ?? 'nordwand')}://localhost/strava`;

/** Fehler der Edge Function mit Code aus der Antwort (z. B. «not_connected»). */
export class StravaError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Text zum Fehlercode der Edge Function (erst beim Auftreten übersetzt). */
function message(code: string): string | undefined {
  switch (code) {
    case 'not_configured':
      return t('contract.strava.notConfigured');
    case 'not_deployed':
      return t('contract.strava.notDeployed');
    case 'not_connected':
      return t('contract.strava.notConnected');
    case 'not_authenticated':
      return t('common.signInFirst');
    case 'bad_state':
      return t('contract.strava.badState');
    case 'bad_code':
      return t('contract.strava.badCode');
    default:
      return undefined;
  }
}

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  if (!supabase || !getSession()) throw new StravaError(t('common.signInFirst'), 'not_authenticated');
  const { data, error } = await supabase.functions.invoke('strava', { body: { action, ...extra } });
  if (error) {
    const res = (error as { context?: Response }).context;
    let code = '';
    if (res && typeof res.json === 'function') {
      try {
        code = String(((await res.clone().json()) as { error?: string }).error ?? '');
      } catch {
        // keine JSON-Antwort
      }
    }
    // 404 ohne eigenen Fehlercode: Funktion ist nicht deployt
    if (!code && res?.status === 404) code = 'not_deployed';
    throw new StravaError(message(code) ?? t('contract.strava.unreachable', { detail: String(code || res?.status || error.message) }), code || 'unknown');
  }
  return data as T;
}

export function stravaAvailableHere(): string | null {
  if (Platform.OS === 'web') return t('contract.strava.webOnly');
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return t('contract.strava.expoGo');
  }
  return null;
}

/** Verbinden: Strava-Anmeldung im Browser, dann Code an den Server. Gibt einen Fehlertext zurück oder null. */
export async function connectStrava(): Promise<string | null> {
  const blocked = stravaAvailableHere();
  if (blocked) return blocked;
  try {
    const { clientId, state } = await call<{ clientId: string; state: string }>('config');
    const url =
      'https://www.strava.com/oauth/mobile/authorize' +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
      `&state=${encodeURIComponent(state)}` +
      '&response_type=code&approval_prompt=auto&scope=activity:read_all';
    const res = await WebBrowser.openAuthSessionAsync(url, REDIRECT);
    if (res.type !== 'success') return null; // abgebrochen
    const params = new URL(res.url).searchParams;
    if (params.get('error')) return t('contract.strava.denied');
    const code = params.get('code');
    if (!code) return t('contract.strava.noCode');
    if (params.get('state') !== state) return t('contract.strava.mismatch');
    if (!(params.get('scope') ?? '').includes('activity:read')) {
      return t('contract.strava.needActivity');
    }
    const r = await call<{ athleteName: string }>('connect', { code, state });
    updateSettings({ stravaAthlete: r.athleteName || 'Strava' });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export async function disconnectStrava(): Promise<string | null> {
  try {
    await call('disconnect');
    updateSettings({ stravaAthlete: null });
    return null;
  } catch (e) {
    if (e instanceof StravaError && e.code === 'not_connected') {
      updateSettings({ stravaAthlete: null });
      return null;
    }
    return e instanceof Error ? e.message : String(e);
  }
}

/** Trainingsminuten pro Tag aus Strava (nur für die angefragten Tage). */
export async function stravaWorkoutMinutes(dates: ISODate[]): Promise<Record<ISODate, number>> {
  if (!dates.length || !getState().settings.stravaAthlete) return {};
  const first = [...dates].sort()[0];
  const after = Math.floor(parseISO(addDays(first, -1)).getTime() / 1000);
  try {
    const { activities } = await call<{ activities: { startLocal: string; minutes: number }[] }>('activities', { after });
    const out: Record<ISODate, number> = {};
    for (const a of activities) {
      const day = a.startLocal.slice(0, 10);
      if (dates.includes(day)) out[day] = (out[day] ?? 0) + a.minutes;
    }
    return out;
  } catch (e) {
    // Auf strava.com getrennt: in der App als «nicht verbunden» anzeigen
    if (e instanceof StravaError && e.code === 'not_connected') updateSettings({ stravaAthlete: null });
    else console.warn('Strava', e);
    return {};
  }
}
