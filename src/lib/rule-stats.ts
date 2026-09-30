/**
 * Statistik für eine einzelne Regel (getestet): Serien, Wochentage, Wochenverlauf, Mengen.
 */

import { type ArcLog, isRuleActiveOn, isValueDone, ruleValue } from './arc';
import { addDays, diffDays, type ISODate, maxISO, minISO, rangeDays, weekdayIndex, weekStart } from './date';
import type { Arc, Rule } from './types';

export interface WeekdayStat {
  /** 0 = Montag */
  weekday: number;
  hits: number;
  days: number;
  rate: number;
}

export interface WeekStat {
  week: ISODate;
  hits: number;
  /** Tägliche Regel: aktive Tage der Woche; wöchentliche Regel: Ziel pro Woche */
  target: number;
  /** Läuft die Woche noch? */
  running: boolean;
}

export interface AmountStat {
  unit: string;
  target: number;
  total: number;
  /** Durchschnitt über alle gezählten Tage */
  average: number;
  best: { date: ISODate; value: number } | null;
}

export interface RuleDetail {
  rule: Rule;
  /** Tage (täglich) bzw. Wochen (wöchentlich) am Stück erfüllt, bis heute */
  currentRun: number;
  bestRun: number;
  runUnit: 'Tage' | 'Wochen';
  hits: number;
  expected: number;
  rate: number;
  weekdays: WeekdayStat[];
  /** Nur bei täglichen Regeln mit genug Daten: der schwächste Wochentag */
  weakestWeekday: number | null;
  weeks: WeekStat[];
  /** Letzte 14 gezählte Tage, ältester zuerst (true = erfüllt) */
  recent: { date: ISODate; hit: boolean }[];
  amount: AmountStat | null;
}

/** Tage, die für diese Regel zählen: aktiv, im Arc, bis heute (heute nur, wenn schon erfüllt). */
export function countedDays(arc: Arc, log: ArcLog, rule: Rule, today: ISODate): ISODate[] {
  const from = maxISO(arc.startDate, rule.activeFrom);
  const to = minISO(arc.endDate, today);
  if (to < from) return [];
  const hit = (d: ISODate) => isValueDone(rule, ruleValue(log, d, rule.id));
  return rangeDays(from, to).filter((d) => isRuleActiveOn(rule, d) && (d !== today || hit(d)));
}

export function ruleDetail(arc: Arc, log: ArcLog, rule: Rule, today: ISODate): RuleDetail {
  const hit = (d: ISODate) => isValueDone(rule, ruleValue(log, d, rule.id));
  const days = countedDays(arc, log, rule, today);
  const daily = rule.frequency.kind === 'daily';
  const times = rule.frequency.kind === 'weekly' ? rule.frequency.times : 7;

  // ---------- Wochen ----------
  const weeks: WeekStat[] = [];
  const firstWeek = weekStart(maxISO(arc.startDate, rule.activeFrom));
  const lastDay = minISO(arc.endDate, today);
  for (let wk = firstWeek; wk <= lastDay; wk = addDays(wk, 7)) {
    const inWeek = rangeDays(wk, addDays(wk, 6)).filter(
      (d) => d >= arc.startDate && d <= arc.endDate && isRuleActiveOn(rule, d),
    );
    if (!inWeek.length) continue;
    const upToToday = inWeek.filter((d) => d <= today);
    const hits = upToToday.filter(hit).length;
    const running = addDays(wk, 6) >= today && today <= arc.endDate;
    const target = daily ? inWeek.length : Math.min(times, Math.ceil((times * inWeek.length) / 7));
    weeks.push({ week: wk, hits: daily ? hits : Math.min(hits, times), target, running });
  }

  // ---------- Serien ----------
  let currentRun = 0;
  let bestRun = 0;
  if (daily) {
    let run = 0;
    for (const d of days) {
      run = hit(d) ? run + 1 : 0;
      bestRun = Math.max(bestRun, run);
    }
    // Aktuelle Serie: von hinten zählen (heute zählt nur, wenn erfüllt – sonst ab gestern).
    for (let i = days.length - 1; i >= 0 && hit(days[i]); i--) currentRun++;
  } else {
    let run = 0;
    for (const w of weeks) {
      if (w.running && w.hits < w.target) continue; // laufende Woche bricht die Serie (noch) nicht
      run = w.hits >= w.target ? run + 1 : 0;
      bestRun = Math.max(bestRun, run);
    }
    for (let i = weeks.length - 1; i >= 0; i--) {
      const w = weeks[i];
      if (w.running && w.hits < w.target) continue;
      if (w.hits >= w.target) currentRun++;
      else break;
    }
  }

  // ---------- Quote ----------
  let hits: number;
  let expected: number;
  if (daily) {
    hits = days.filter(hit).length;
    expected = days.length;
  } else {
    const done = weeks.filter((w) => !w.running || w.hits >= w.target);
    hits = done.reduce((s, w) => s + Math.min(w.hits, w.target), 0);
    expected = done.reduce((s, w) => s + w.target, 0);
  }

  // ---------- Wochentage ----------
  const weekdays: WeekdayStat[] = Array.from({ length: 7 }, (_, i) => ({ weekday: i, hits: 0, days: 0, rate: 0 }));
  for (const d of days) {
    const w = weekdays[weekdayIndex(d)];
    w.days++;
    if (hit(d)) w.hits++;
  }
  for (const w of weekdays) w.rate = w.days ? w.hits / w.days : 0;
  let weakestWeekday: number | null = null;
  if (daily && days.length >= 14) {
    const withData = weekdays.filter((w) => w.days >= 2);
    const min = withData.reduce<WeekdayStat | null>((a, b) => (!a || b.rate < a.rate ? b : a), null);
    const max = Math.max(...withData.map((w) => w.rate));
    // Nur nennen, wenn es wirklich einen Unterschied gibt.
    if (min && max - min.rate >= 0.15) weakestWeekday = min.weekday;
  }

  // ---------- Mengen ----------
  let amount: AmountStat | null = null;
  if (rule.measure.kind === 'amount') {
    let total = 0;
    let best: AmountStat['best'] = null;
    for (const d of days) {
      const v = ruleValue(log, d, rule.id);
      total += v;
      if (v > 0 && (!best || v > best.value)) best = { date: d, value: v };
    }
    amount = {
      unit: rule.measure.unit,
      target: rule.measure.target,
      total,
      average: days.length ? total / days.length : 0,
      best,
    };
  }

  const recent = days.slice(-14).map((d) => ({ date: d, hit: hit(d) }));

  return {
    rule,
    currentRun,
    bestRun,
    runUnit: daily ? 'Tage' : 'Wochen',
    hits,
    expected,
    rate: expected ? hits / expected : 0,
    weekdays,
    weakestWeekday,
    weeks,
    recent,
    amount,
  };
}

/** Anzahl Tage seit dem letzten Erfüllen (null = noch nie). */
export function daysSinceLastHit(arc: Arc, log: ArcLog, rule: Rule, today: ISODate): number | null {
  const days = countedDays(arc, log, rule, today).filter((d) => isValueDone(rule, ruleValue(log, d, rule.id)));
  const last = days[days.length - 1];
  return last ? diffDays(last, today) : null;
}
