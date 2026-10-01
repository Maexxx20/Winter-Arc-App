/** Daten fürs Widget (getestet) – das Widget selbst rechnet nichts. */

import { activeRules, computeStats, dayProgress, isValueDone, ruleValue } from './arc';
import { diffDays, type ISODate } from './date';
import type { AppState } from './types';

export interface WidgetData {
  date: string;
  title: string;
  started: boolean;
  /** Kein laufender Arc (keiner angelegt oder vorbei) */
  ended: boolean;
  daysToStart: number;
  dayNumber: number;
  totalDays: number;
  streak: number;
  done: number;
  total: number;
  rules: { id: string; icon: string; title: string; done: boolean }[];
  tapped: string[];
  /** Fertige Texte in der Sprache der App (das Widget selbst kann nicht übersetzen) */
  labels: WidgetLabels;
}

export interface WidgetLabels {
  dayOf: string;
  dayShort: string;
  inline: string;
  /** Vorlage mit {done} und {total} – das Widget setzt die Zahlen nach dem Abhaken neu ein */
  today: string;
  held: string;
  allDone: string;
  streak: string;
  untilStart: string;
  inlineStart: string;
  noArc: string;
  noArcHint: string;
  inlineNoArc: string;
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

const EMPTY_LABELS: WidgetLabels = {
  dayOf: '', dayShort: '', inline: '', today: '{done}/{total}', held: '', allDone: '', streak: '', untilStart: '', inlineStart: '', noArc: '', noArcHint: '', inlineNoArc: '',
};

/** Texte fürs Widget (mit `t` aus @/i18n). */
export function widgetLabels(d: Omit<WidgetData, 'labels'>, tr: Translate): WidgetLabels {
  return {
    dayOf: tr('widget.dayOf', { day: d.dayNumber, total: d.totalDays }),
    dayShort: tr('widget.dayShort'),
    inline: tr('widget.inline', { day: d.dayNumber, total: d.totalDays, streak: d.streak }),
    today: tr('widget.today', { done: '{done}', total: '{total}' }),
    held: tr('widget.held'),
    allDone: tr('widget.allDone'),
    streak: tr('widget.streak', { count: d.streak }),
    untilStart: tr('widget.untilStart', { count: d.daysToStart }),
    inlineStart: tr('widget.inlineStart', { count: d.daysToStart }),
    noArc: tr('widget.noArc'),
    noArcHint: tr('widget.noArcHint'),
    inlineNoArc: tr('widget.inlineNoArc'),
  };
}

/** Anzeige ohne laufenden Arc («Neuen Arc starten»). */
export function endedWidgetData(today: ISODate, title = 'Nordwand'): WidgetData {
  return { date: today, title, started: true, ended: true, daysToStart: 0, dayNumber: 0, totalDays: 0, streak: 0, done: 0, total: 0, rules: [], tapped: [], labels: EMPTY_LABELS };
}

/** null, wenn es keinen aktiven Arc gibt; «ended», wenn der Tag nach dem Arc liegt. */
export function widgetData(state: AppState, today: ISODate): WidgetData | null {
  const arc = state.arcs.find((a) => a.id === state.activeArcId);
  if (!arc) return null;
  if (today > arc.endDate || arc.status !== 'active') return endedWidgetData(today, arc.title);
  const log = state.logs[arc.id] ?? {};
  const stats = computeStats(arc, log, today);
  const progress = dayProgress(arc, log, today);
  const daily = activeRules(arc, today).filter((r) => r.frequency.kind === 'daily');
  return {
    date: today,
    title: arc.title,
    started: stats.started,
    ended: false,
    daysToStart: stats.started ? 0 : diffDays(today, arc.startDate),
    dayNumber: Math.min(stats.dayNumber, stats.totalDays),
    totalDays: stats.totalDays,
    streak: stats.streak.current,
    done: progress.done,
    total: progress.total,
    rules: daily.slice(0, 4).map((r) => ({
      id: r.id,
      icon: r.icon,
      title: r.title,
      done: isValueDone(r, ruleValue(log, today, r.id)),
    })),
    tapped: [],
    labels: EMPTY_LABELS,
  };
}

/** Widget-Daten samt Texten (null ohne aktiven Arc → «Kein laufender Arc»). */
export function widgetDataWithLabels(state: AppState, today: ISODate, tr: Translate): WidgetData {
  const d = widgetData(state, today) ?? endedWidgetData(today);
  return { ...d, labels: widgetLabels(d, tr) };
}

/** Im Widget abgehakte Regeln, die in der App noch offen sind: ruleId → einzutragender Wert. */
export function widgetTapsToApply(state: AppState, data: Pick<WidgetData, 'date' | 'tapped'>): Record<string, number> {
  const arc = state.arcs.find((a) => a.id === state.activeArcId);
  if (!arc || !data.tapped?.length || data.date < arc.startDate || data.date > arc.endDate) return {};
  const log = state.logs[arc.id] ?? {};
  const out: Record<string, number> = {};
  for (const id of new Set(data.tapped)) {
    const rule = arc.rules.find((r) => r.id === id);
    if (!rule || isValueDone(rule, ruleValue(log, data.date, id))) continue;
    out[id] = rule.measure.kind === 'amount' ? rule.measure.target : 1;
  }
  return out;
}
