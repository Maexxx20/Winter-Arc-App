import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect } from 'react';
import { AppState as RNAppState } from 'react-native';

import { onLangChange } from '@/i18n';
import { isHydrated, subscribe } from '@/store/store';

type WidgetLib = typeof import('react-native-android-widget');
type Handler = typeof import('@/widgets/android/task-handler');

let lib: WidgetLib | null | undefined;
let handler: Handler | null = null;

/** Native Bibliothek laden – in Expo Go gibt es sie nicht. */
function load(): WidgetLib | null {
  if (lib !== undefined) return lib;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (lib = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('react-native-android-widget') as WidgetLib;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    handler = require('@/widgets/android/task-handler') as Handler;
  } catch {
    lib = null;
  }
  return lib;
}

export function widgetsAvailable(): boolean {
  return !!load();
}

/** Hintergrund-Aufgabe fürs Widget anmelden (im Einstiegspunkt, vor dem ersten Rendern). */
export function registerAndroidWidget() {
  const l = load();
  if (l && handler) l.registerWidgetTaskHandler(handler.widgetTaskHandler);
}

function update() {
  const l = load();
  if (!l || !handler || !isHydrated()) return;
  const h = handler;
  l.requestWidgetUpdate({
    widgetName: h.ANDROID_WIDGET_NAME,
    renderWidget: (info) => h.renderNordwand(info.width),
  }).catch(() => undefined);
}

/** Im Root-Layout: Widget nach jeder Änderung neu zeichnen (gebündelt). */
export function useWidgetSync() {
  useEffect(() => {
    if (!load()) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(update, 800);
    };
    later();
    const unsub = subscribe(later);
    const offLang = onLangChange(later);
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active' || st === 'background') later();
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
      offLang();
      sub.remove();
    };
  }, []);
}
