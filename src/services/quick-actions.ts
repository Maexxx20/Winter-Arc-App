/**
 * Schnellaktionen beim langen Drücken aufs App-Icon (iOS und Android).
 * Das native Modul gibt es erst im Development-Build – in Expo Go und im Browser passiert nichts.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { onLangChange, t } from '@/i18n';

type QuickActionsModule = typeof import('expo-quick-actions');

let mod: QuickActionsModule | null | undefined;
let initialHandled = false;

function load(): QuickActionsModule | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-quick-actions') as QuickActionsModule;
  } catch {
    mod = null;
  }
  return mod;
}

type Href = '/' | '/tag/heute' | '/fortschritt' | '/crew';

function items() {
  const ios = Platform.OS === 'ios';
  const item = (id: string, title: string, href: Href, symbol: string) => ({
    id,
    title,
    icon: ios ? `symbol:${symbol}` : null,
    params: { href },
  });
  return [
    item('today', t('extras.quick.today'), '/', 'checkmark.circle'),
    item('note', t('extras.quick.note'), '/tag/heute', 'square.and.pencil'),
    item('progress', t('extras.quick.progress'), '/fortschritt', 'photo.on.rectangle'),
    item('crew', t('extras.quick.crew'), '/crew', 'person.3'),
  ];
}

function setItems() {
  load()
    ?.setItems(items())
    .catch(() => undefined);
}

function open(action: { params?: Record<string, unknown> | null } | undefined) {
  const href = action?.params?.href;
  if (typeof href !== 'string') return;
  // «/tag/heute» öffnet den heutigen Tag (ungültiges Datum → heute)
  setTimeout(() => router.navigate(href as Href), 0);
}

/** Im Tab-Layout (nicht im Root-Layout, dort ist die Navigation noch nicht bereit). */
export function useQuickActions() {
  useEffect(() => {
    const m = load();
    if (!m) return;
    setItems();
    const offLang = onLangChange(setItems);
    if (m.initial && !initialHandled) {
      initialHandled = true;
      open(m.initial);
    }
    const sub = m.addListener((a) => open(a));
    return () => {
      offLang();
      sub.remove();
    };
  }, []);
}
