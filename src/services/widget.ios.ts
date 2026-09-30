import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect } from 'react';
import { AppState as RNAppState } from 'react-native';

import { addDays, parseISO, todayISO } from '@/lib/date';
import { widgetData, widgetTapsToApply } from '@/lib/widget-data';
import { getState, isHydrated, selectActiveArc, setRuleValue, subscribe } from '@/store/store';

type WidgetModule = typeof import('@/widgets/nordwand-widget');
type Widgets = typeof import('expo-widgets');

let widget: WidgetModule['default'] | null | undefined;
let widgets: Widgets | null | undefined;

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

/** Im Widget abgehakte Regeln übernehmen. */
async function applyTaps() {
  const w = load();
  if (!w) return;
  try {
    const timeline = await w.getTimeline();
    const now = Date.now();
    const current = timeline.filter((e) => e.date.getTime() <= now).pop() ?? timeline[0];
    if (!current?.props?.tapped?.length) return;
    const s = getState();
    const arc = selectActiveArc(s);
    if (!arc) return;
    const values = widgetTapsToApply(s, current.props);
    for (const [ruleId, value] of Object.entries(values)) setRuleValue(arc.id, current.props.date, ruleId, value);
  } catch (e) {
    console.warn('Widget lesen fehlgeschlagen', e);
  }
}

/** Widget mit dem aktuellen Stand füllen; um Mitternacht schaltet es auf den neuen Tag. */
function push() {
  const w = load();
  if (!w || !isHydrated()) return;
  const s = getState();
  const today = todayISO(new Date(), s.settings.rolloverHour);
  const now = widgetData(s, today);
  if (!now) return;
  const tomorrow = addDays(today, 1);
  const next = widgetData(s, tomorrow);
  const midnight = parseISO(tomorrow);
  midnight.setHours(s.settings.rolloverHour);
  try {
    w.updateTimeline([
      { date: new Date(), props: now },
      ...(next ? [{ date: midnight, props: next }] : []),
    ]);
  } catch (e) {
    console.warn('Widget aktualisieren fehlgeschlagen', e);
  }
}

/** Im Root-Layout: Widget aktuell halten und Taps aus dem Widget übernehmen. */
export function useWidgetSync() {
  useEffect(() => {
    if (!load()) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(push, 800);
    };
    const start = setTimeout(async () => {
      await applyTaps();
      push();
    }, 1500);
    const unsub = subscribe(later);
    const appSub = RNAppState.addEventListener('change', async (st) => {
      if (st === 'active') {
        await applyTaps();
        push();
      }
    });
    const tapSub = widgets?.addUserInteractionListener(() => applyTaps().then(push));
    return () => {
      if (timer) clearTimeout(timer);
      clearTimeout(start);
      unsub();
      appSub.remove();
      tapSub?.remove();
    };
  }, []);
}
