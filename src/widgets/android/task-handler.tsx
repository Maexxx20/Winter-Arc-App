/**
 * Läuft im Hintergrund, wenn Android das Widget zeichnen will oder jemand darauf tippt –
 * auch wenn die App gar nicht offen ist. Darum: Zustand selbst laden und nach Änderungen sofort speichern.
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { type TKey, t } from '@/i18n';
import { todayISO } from '@/lib/date';
import { widgetDataWithLabels, widgetTapsToApply } from '@/lib/widget-data';
import { applyLanguage } from '@/services/language';
import { flushState, getState, hydrate, selectActiveArc, setRuleValue } from '@/store/store';

import { NordwandAndroidWidget } from './nordwand-android';

export const ANDROID_WIDGET_NAME = 'Nordwand';

const tr = (k: string, v?: Record<string, string | number>) => t(k as TKey, v);

export function renderNordwand(width: number) {
  const s = getState();
  const today = todayISO(new Date(), s.settings.rolloverHour);
  return NordwandAndroidWidget({ data: widgetDataWithLabels(s, today, tr), width });
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  await hydrate(applyLanguage);
  if (props.widgetInfo.widgetName !== ANDROID_WIDGET_NAME) return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(renderNordwand(props.widgetInfo.width));
      break;
    case 'WIDGET_CLICK': {
      if (props.clickAction === 'TOGGLE_RULE') {
        const ruleId = String(props.clickActionData?.ruleId ?? '');
        const date = String(props.clickActionData?.date ?? '');
        const s = getState();
        const arc = selectActiveArc(s);
        // Nur für den Tag, den das Widget gerade zeigt (nach Mitternacht nicht mehr den Vortag)
        if (arc && ruleId && date === todayISO(new Date(), s.settings.rolloverHour)) {
          for (const [id, value] of Object.entries(widgetTapsToApply(s, { date, tapped: [ruleId] }))) setRuleValue(arc.id, date, id, value);
          await flushState();
        }
      }
      props.renderWidget(renderNordwand(props.widgetInfo.width));
      break;
    }
    default:
      break;
  }
}
