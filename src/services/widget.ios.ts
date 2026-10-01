import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect } from 'react';
import { AppState as RNAppState } from 'react-native';

import { addDays, parseISO, todayISO } from '@/lib/date';
import { onLangChange, type TKey, t } from '@/i18n';
import { widgetDataWithLabels, widgetTapsToApply } from '@/lib/widget-data';
import { getState, isHydrated, selectActiveArc, setRuleValue, subscribe } from '@/store/store';

type WidgetModule = typeof import('@/widgets/nordwand-widget');
type Widgets = typeof import('expo-widgets');

let widget: WidgetModule['default'] | null | undefined;
let widgets: Widgets | null | undefined;
/** Erst nach dem ersten Übernehmen der Taps überschreiben – sonst gehen Häkchen aus dem Widget verloren. */
let ready = false;

/** Widget-Modul laden – in Expo Go gibt es das native Modul nicht. */
function load() {
  if (widget !== undefined) return widget;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (widget = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    widget = (require('@/widgets/nordwand-widget') as WidgetModule).default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    widgets = require('expo-widgets') as Widgets;
  } catch {
    widget = null;
    widgets = null;
  }
  return widget;
}

/** Gibt es Widgets in diesem Build? (Nicht in Expo Go.) */
export function widgetsAvailable(): boolean {
  return !!load();
}

/** Im Widget abgehakte Regeln übernehmen – aus allen Einträgen, jeweils für ihren eigenen Tag. */
async function applyTaps() {
  const w = load();
  if (!w || !isHydrated()) return;
  try {
    const timeline = await w.getTimeline();
    for (const entry of timeline) {
      if (!entry.props?.tapped?.length) continue;
      const s = getState();
      const arc = selectActiveArc(s);
      if (!arc) return;
      const values = widgetTapsToApply(s, entry.props);
      for (const [ruleId, value] of Object.entries(values)) setRuleValue(arc.id, entry.props.date, ruleId, value);
    }
  } catch (e) {
    console.warn('Widget lesen fehlgeschlagen', e);
  }
}

/** Widget mit dem aktuellen Stand füllen; zum Tageswechsel schaltet es auf den neuen Tag. */
function push() {
  const w = load();
  if (!w || !ready || !isHydrated()) return;
  const s = getState();
  const today = todayISO(new Date(), s.settings.rolloverHour);
  const tomorrow = addDays(today, 1);
  const tr = (k: string, v?: Record<string, string | number>) => t(k as TKey, v);
  const now = widgetDataWithLabels(s, today, tr);
  // Der Eintrag für morgen ist eine Vorschau: Häkchen, die du danach nur im Widget setzt,
  // kennt er noch nicht – beim nächsten Öffnen der App wird er neu berechnet.
  const next = widgetDataWithLabels(s, tomorrow, tr);
  const switchAt = parseISO(tomorrow);
  switchAt.setHours(s.settings.rolloverHour, 0, 0, 0);
  try {
    w.updateTimeline([
      { date: new Date(), props: now },
      { date: switchAt, props: next },
    ]);
  } catch (e) {
    console.warn('Widget aktualisieren fehlgeschlagen', e);
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Im Root-Layout: Widget aktuell halten und Taps aus dem Widget übernehmen. */
export function useWidgetSync() {
  useEffect(() => {
    if (!load()) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(push, 800);
    };
    const refresh = () => applyTaps().then(push);
    (async () => {
      while (alive && !isHydrated()) await wait(250);
      if (!alive) return;
      await applyTaps();
      ready = true;
      push();
    })();
    const unsub = subscribe(later);
    const offLang = onLangChange(later);
    const appSub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active' && ready) refresh();
    });
    const tapSub = widgets?.addUserInteractionListener(() => {
      if (ready) refresh();
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsub();
      offLang();
      appSub.remove();
      tapSub?.remove();
    };
  }, []);
}
