/**
 * Health-Verknüpfung (getestet): Welche Messung erfüllt welche Regel?
 * Die Werte kommen aus Apple Health, Health Connect oder Strava; hier wird nur gerechnet.
 */

import { formatNumber, t } from '@/i18n';

import { isValueDone } from './arc';
import type { ISODate } from './date';
import type { HealthLink, HealthMetric, Rule } from './types';

export interface HealthMetricDef {
  id: HealthMetric;
  label: string;
  icon: string;
  /** Einheit der Schwelle */
  unit: string;
  defaultThreshold: number;
  step: number;
  min: number;
  max: number;
  hint: string;
}

/** Texte (label, unit, hint) werden erst beim Lesen übersetzt – Sprache kann zur Laufzeit wechseln. */
function metric(id: HealthMetric, icon: string, defaultThreshold: number, step: number, min: number, max: number): HealthMetricDef {
  return {
    id,
    icon,
    defaultThreshold,
    step,
    min,
    max,
    get label() {
      return t(`contract.health.${id}.label`);
    },
    get unit() {
      return t(`contract.health.${id}.unit`);
    },
    get hint() {
      return t(`contract.health.${id}.hint`);
    },
  };
}

export const HEALTH_METRICS: HealthMetricDef[] = [
  metric('steps', '🚶', 10000, 1000, 1000, 40000),
  metric('workout', '🏋️', 30, 5, 5, 240),
  metric('sleep', '🛌', 7, 0.5, 4, 11),
  metric('water', '💧', 2, 0.25, 0.5, 6),
  metric('mindful', '🧘', 10, 5, 5, 120),
];

export const HEALTH_METRIC_BY_ID = Object.fromEntries(HEALTH_METRICS.map((m) => [m.id, m])) as Record<HealthMetric, HealthMetricDef>;

/** Tageswerte in festen Einheiten: Schritte, Minuten, Stunden, Liter, Minuten. */
export type HealthDay = Partial<Record<HealthMetric, number>>;

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

// Einheiten in allen vier Sprachen (Regeln können in jeder Sprache angelegt sein)
const isSteps = (u: string) => has(u, 'schritt', 'step', 'passi') || u === 'pas';
const isHours = (u: string) => u === 'h' || has(u, 'std', 'stunde', 'hour', 'heure', 'ora', 'ore');
const isMinutes = (u: string) => u.startsWith('min');
const isLiters = (u: string) => u === 'l' || has(u, 'liter', 'litre', 'litri', 'litro');
const isGlasses = (u: string) => has(u, 'glas', 'gläs', 'glass', 'verre', 'bicchier');

/** Vorschlag, welche Messung zu einer Regel passt (oder null). Erkennt Deutsch, Englisch, Französisch, Italienisch. */
export function suggestHealthLink(rule: Pick<Rule, 'title' | 'measure'>): HealthLink | null {
  const title = rule.title.toLowerCase();
  const unit = rule.measure.kind === 'amount' ? rule.measure.unit.toLowerCase().trim() : '';
  const target = rule.measure.kind === 'amount' ? rule.measure.target : null;
  // «pas» nur nach einer Zahl («10 000 pas»), sonst wäre «Ne pas fumer» eine Schritt-Regel
  if (has(title, 'schritt', 'steps', 'passi') || /\d\s*pas\b/.test(title) || (unit && isSteps(unit))) {
    const n = title.match(/(\d[\d'’ .,]*\d|\d+)/)?.[0]?.replace(/['’ .,]/g, '');
    return { metric: 'steps', threshold: target ?? (n ? Number(n) : 10000) };
  }
  if (has(title, 'schlaf', 'sleep', 'sommeil', 'dormir', 'sonno', 'dormire') && !has(title, 'vor ', 'uhr', 'before', 'avant', 'prima'))
    return { metric: 'sleep', threshold: target && isHours(unit) ? target : 7 };
  if (has(title, 'wasser', 'trinken', 'water', 'drink', 'eau', 'boire', 'acqua', 'bere')) {
    if (target && unit === 'ml') return { metric: 'water', threshold: target / 1000 };
    if (target && isLiters(unit)) return { metric: 'water', threshold: target };
    if (target && isGlasses(unit)) return { metric: 'water', threshold: Math.round(target * 0.25 * 4) / 4 };
    return { metric: 'water', threshold: 2 };
  }
  if (has(title, 'medit', 'médit', 'achtsam', 'atem', 'mindful', 'breath', 'respir', 'pleine conscience', 'consapevol'))
    return { metric: 'mindful', threshold: target && isMinutes(unit) ? target : 10 };
  if (
    has(title, 'training', 'gym', 'sport', 'workout', 'laufen', 'joggen', 'velo', 'vélo', 'rad', 'schwimm', 'eishockey', 'hockey', 'fitness',
      'run', 'swim', 'cycl', 'bike', 'entraîn', 'entrain', 'course', 'natation', 'allenament', 'corsa', 'nuoto', 'bici', 'palestra')
  ) {
    return { metric: 'workout', threshold: target && isMinutes(unit) ? target : 30 };
  }
  return null;
}

/** Messwert in die Einheit einer Mengen-Regel umrechnen (null = passt nicht zusammen). */
function toRuleUnit(metric: HealthMetric, value: number, unit: string): number | null {
  const u = unit.toLowerCase().trim();
  switch (metric) {
    case 'steps':
      return isSteps(u) ? value : null;
    case 'workout':
    case 'mindful':
      if (isMinutes(u)) return value;
      if (isHours(u)) return value / 60;
      return null;
    case 'sleep':
      if (isHours(u)) return value;
      if (isMinutes(u)) return value * 60;
      return null;
    case 'water':
      if (u === 'ml') return value * 1000;
      if (isLiters(u)) return value;
      if (isGlasses(u)) return value / 0.25;
      return null;
  }
}

/**
 * Wert, den die Regel durch die Messung bekommt (null = nichts eintragen).
 * Abhaken: 1, sobald die Schwelle erreicht ist. Menge: der gemessene Wert in der Einheit der Regel.
 */
export function healthValueForRule(rule: Rule, link: HealthLink, day: HealthDay): number | null {
  const measured = day[link.metric];
  if (measured === undefined || measured <= 0) return null;
  if (rule.measure.kind === 'check') return measured >= link.threshold ? 1 : null;
  const converted = toRuleUnit(link.metric, measured, rule.measure.unit);
  if (converted !== null) return Math.round(converted * 100) / 100;
  // Einheit passt nicht (z. B. «Training: 1 Einheit»): bei erreichter Schwelle das Ziel eintragen.
  return measured >= link.threshold ? rule.measure.target : null;
}

/**
 * Neuer Wert nach dem Abgleich: Health hebt nur an, nimmt nie etwas weg.
 * Was du von Hand eingetragen hast, bleibt – ausser Health misst mehr.
 */
export function mergeHealthValue(rule: Rule, current: number, fromHealth: number | null): number | null {
  if (fromHealth === null) return null;
  if (rule.measure.kind === 'check') return current >= 1 || !isValueDone(rule, fromHealth) ? null : 1;
  return fromHealth > current ? fromHealth : null;
}

/**
 * Wie mergeHealthValue, merkt sich aber, was Health zuletzt eingetragen hat (`lastAuto`).
 * Hast du den Wert danach von Hand geändert (z. B. ein falsch erkanntes Training wieder
 * entfernt), bleibt deine Änderung – Health schreibt diesen Tag dann nicht mehr.
 */
export function autoHealthValue(rule: Rule, current: number, fromHealth: number | null, lastAuto: number | undefined): number | null {
  if (lastAuto !== undefined && current !== lastAuto) return null;
  const next = mergeHealthValue(rule, current, fromHealth);
  if (next === null) return null;
  return lastAuto !== undefined && next <= lastAuto ? null : next;
}

/** Schlüssel für `AppState.healthAuto` */
export const healthAutoKey = (arcId: string, date: ISODate, ruleId: string) => `${arcId}|${date}|${ruleId}`;

// ---------- Zeitfenster ----------

const localDate = (date: ISODate, hour: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
};

/** Zeitfenster eines App-Tages: von «Tagesbeginn» bis zum nächsten (berücksichtigt «Tag endet um 3 Uhr»). */
export function healthDayWindow(date: ISODate, rolloverHour = 0): { start: Date; end: Date } {
  const start = localDate(date, rolloverHour);
  const [y, m, d] = date.split('-').map(Number);
  const end = new Date(y, m - 1, d + 1, rolloverHour, 0, 0, 0);
  return { start, end };
}

/**
 * Schlaf zählt für den Tag, an dem er endet: Suche von 12 Uhr am Vortag bis 18 Uhr,
 * gezählt werden Phasen, die nach Mitternacht enden (ein Mittagsschlaf gehört noch dazu).
 */
export function sleepWindow(date: ISODate): { from: Date; to: Date; endFrom: Date } {
  const [y, m, d] = date.split('-').map(Number);
  return {
    from: new Date(y, m - 1, d - 1, 12, 0, 0, 0),
    to: new Date(y, m - 1, d, 18, 0, 0, 0),
    endFrom: localDate(date, 0),
  };
}

export interface Interval {
  start: number;
  end: number;
}

/** Intervalle auf ein Zeitfenster zuschneiden (ein Training über Mitternacht zählt je Tag nur anteilig). */
export function clipIntervals(intervals: Interval[], from: Date, to: Date): Interval[] {
  const a = from.getTime();
  const b = to.getTime();
  return intervals.map((i) => ({ start: Math.max(i.start, a), end: Math.min(i.end, b) })).filter((i) => i.end > i.start);
}

/** Teile von `base` ohne die Zeiten in `cut` (z. B. Schlaf ohne Wachphasen). */
export function subtractIntervals(base: Interval[], cut: Interval[]): Interval[] {
  let out = base.filter((i) => i.end > i.start);
  for (const c of cut) {
    const next: Interval[] = [];
    for (const i of out) {
      if (c.end <= i.start || c.start >= i.end) next.push(i);
      else {
        if (c.start > i.start) next.push({ start: i.start, end: c.start });
        if (c.end < i.end) next.push({ start: c.end, end: i.end });
      }
    }
    out = next;
  }
  return out;
}

/** Workout-Minuten aus mehreren Quellen: das Maximum, damit nichts doppelt zählt (Garmin → Health und Strava). */
export function combineWorkoutMinutes(...sources: (number | undefined)[]): number | undefined {
  const values = sources.filter((v): v is number => typeof v === 'number');
  return values.length ? Math.max(...values) : undefined;
}

export function formatThreshold(metric: HealthMetric, value: number): string {
  const def = HEALTH_METRIC_BY_ID[metric];
  const n = metric === 'steps' ? formatNumber(value) : String(value).replace('.', t('contract.health.decimal'));
  return `${n} ${def.unit}`;
}

export function describeHealthLink(link: HealthLink): string {
  const def = HEALTH_METRIC_BY_ID[link.metric];
  return t('contract.health.describe', { icon: def.icon, value: formatThreshold(link.metric, link.threshold) });
}

/** Summe der Intervalle ohne Überlappung (z. B. Schlaf von Uhr und Handy), in Minuten. */
export function unionMinutes(intervals: Interval[]): number {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  let total = 0;
  let curStart = 0;
  let curEnd = -Infinity;
  for (const i of sorted) {
    if (i.start > curEnd) {
      if (Number.isFinite(curEnd)) total += curEnd - curStart;
      curStart = i.start;
      curEnd = i.end;
    } else curEnd = Math.max(curEnd, i.end);
  }
  if (Number.isFinite(curEnd)) total += curEnd - curStart;
  return total / 60000;
}
