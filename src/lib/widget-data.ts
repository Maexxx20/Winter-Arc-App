/** Daten fürs Widget (getestet) – das Widget selbst rechnet nichts. */

import { activeRules, computeStats, dayProgress, isValueDone, ruleValue } from './arc';
import { diffDays, type ISODate } from './date';
import type { AppState } from './types';

export interface WidgetData {
  date: string;
  title: string;
  started: boolean;
  daysToStart: number;
  dayNumber: number;
  totalDays: number;
  streak: number;
  done: number;
  total: number;
  rules: { id: string; icon: string; title: string; done: boolean }[];
  tapped: string[];
}

/** null, wenn es keinen laufenden Arc gibt. */
export function widgetData(state: AppState, today: ISODate): WidgetData | null {
  const arc = state.arcs.find((a) => a.id === state.activeArcId);
  if (!arc) return null;
  const log = state.logs[arc.id] ?? {};
  const stats = computeStats(arc, log, today);
  const progress = dayProgress(arc, log, today);
  const daily = activeRules(arc, today).filter((r) => r.frequency.kind === 'daily');
  return {
    date: today,
    title: arc.title,
    started: stats.started,
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
  };
}

/** Im Widget abgehakte Regeln, die in der App noch offen sind: ruleId → einzutragender Wert. */
export function widgetTapsToApply(state: AppState, data: Pick<WidgetData, 'date' | 'tapped'>): Record<string, number> {
  const arc = state.arcs.find((a) => a.id === state.activeArcId);
  if (!arc || !data.tapped?.length) return {};
  const log = state.logs[arc.id] ?? {};
  const out: Record<string, number> = {};
  for (const id of new Set(data.tapped)) {
    const rule = arc.rules.find((r) => r.id === id);
    if (!rule || isValueDone(rule, ruleValue(log, data.date, id))) continue;
    out[id] = rule.measure.kind === 'amount' ? rule.measure.target : 1;
  }
  return out;
}
