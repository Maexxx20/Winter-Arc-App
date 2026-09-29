/**
 * Kernlogik des Arcs: Tagesstatus, Streak mit Schild, Statistiken.
 *
 * Grundprinzip (nach Lally et al. 2010): Ein einzelner verpasster Tag schadet
 * der Gewohnheitsbildung praktisch nicht – gefährlich ist erst das Aufgeben.
 * Darum: "Nie zweimal hintereinander verpassen". Pro Woche rettet ein Schild
 * einen einzelnen verpassten Tag automatisch; zwei verpasste Tage in Folge
 * (oder ein zweiter in derselben Woche) beenden den Streak.
 */

import {
  addDays,
  diffDays,
  type ISODate,
  maxISO,
  minISO,
  rangeDays,
  weekdayIndex,
  weekStart,
} from './date';
import type { Arc, DayEntry, DayStatus, Rule } from './types';

export const HABIT_THRESHOLD_DAYS = 66;
export const SHIELDS_PER_WEEK = 1;

export type ArcLog = Record<ISODate, DayEntry>;

export function isRuleActiveOn(rule: Rule, date: ISODate): boolean {
  if (date < rule.activeFrom) return false;
  if (rule.removedOn && date >= rule.removedOn) return false;
  return true;
}

export function activeRules(arc: Arc, date: ISODate): Rule[] {
  return arc.rules.filter((r) => isRuleActiveOn(r, date));
}

export function currentRules(arc: Arc): Rule[] {
  return arc.rules.filter((r) => !r.removedOn);
}

export function isValueDone(rule: Rule, value: number | undefined): boolean {
  if (!value) return false;
  if (rule.measure.kind === 'check') return value >= 1;
  return value >= rule.measure.target;
}

export function ruleValue(log: ArcLog, date: ISODate, ruleId: string): number {
  return log[date]?.values[ruleId] ?? 0;
}

export interface DayProgress {
  done: number;
  total: number;
  ratio: number; // 0..1
}

/** Fortschritt der täglichen Regeln an einem Tag. */
export function dayProgress(arc: Arc, log: ArcLog, date: ISODate): DayProgress {
  const rules = activeRules(arc, date).filter((r) => r.frequency.kind === 'daily');
  let done = 0;
  for (const r of rules) if (isValueDone(r, ruleValue(log, date, r.id))) done++;
  return { done, total: rules.length, ratio: rules.length ? done / rules.length : 0 };
}

/** Status ohne Schild-Logik. */
function rawStatus(arc: Arc, log: ArcLog, date: ISODate, today: ISODate): DayStatus {
  if (date < arc.startDate || date > arc.endDate) return 'outside';
  if (date > today) return 'future';
  const p = dayProgress(arc, log, date);
  if (p.total === 0) return 'neutral';
  if (p.done === p.total) return 'done';
  if (date === today) return 'open';
  return p.done > 0 ? 'partial' : 'missed';
}

export interface StreakResult {
  current: number;
  best: number;
  /** Status jedes Tages von Start bis Ende (inkl. Schild-Info). */
  statuses: Record<ISODate, DayStatus>;
  /** Tage, an denen ein Schild eingesetzt wurde. */
  shieldedDays: ISODate[];
  /** Ist in der aktuellen Woche noch ein Schild verfügbar? */
  shieldAvailable: boolean;
  /** Gestern verpasst (bzw. geschützt) → heute darf nicht auch noch verpasst werden. */
  onThinIce: boolean;
}

export function computeStreak(arc: Arc, log: ArcLog, today: ISODate): StreakResult {
  const statuses: Record<ISODate, DayStatus> = {};
  const shieldsUsed: Record<ISODate, number> = {}; // Wochenstart → Anzahl
  const shieldedDays: ISODate[] = [];

  let current = 0;
  let best = 0;
  let lastWasMiss = false;

  for (const date of rangeDays(arc.startDate, arc.endDate)) {
    const s = rawStatus(arc, log, date, today);
    statuses[date] = s;
    if (s === 'future' || s === 'open' || s === 'neutral' || s === 'outside') continue;

    if (s === 'done') {
      current++;
      lastWasMiss = false;
    } else {
      const wk = weekStart(date);
      const used = shieldsUsed[wk] ?? 0;
      if (!lastWasMiss && used < SHIELDS_PER_WEEK && current > 0) {
        shieldsUsed[wk] = used + 1;
        statuses[date] = 'shielded';
        shieldedDays.push(date);
      } else {
        current = 0;
      }
      lastWasMiss = true;
    }
    best = Math.max(best, current);
  }

  const thisWeek = weekStart(today);
  return {
    current,
    best,
    statuses,
    shieldedDays,
    shieldAvailable: (shieldsUsed[thisWeek] ?? 0) < SHIELDS_PER_WEEK,
    onThinIce: lastWasMiss && today >= arc.startDate && today <= arc.endDate,
  };
}

export interface RuleStat {
  rule: Rule;
  /** 0..1 */
  consistency: number;
  hits: number;
  expected: number;
}

export interface ArcStats {
  totalDays: number;
  /** 1-basiert; 0 vor dem Start; totalDays+ nach dem Ende. */
  dayNumber: number;
  daysLeft: number;
  started: boolean;
  finished: boolean;
  /** Bewertete Tage (vergangen, plus heute falls erledigt). */
  evaluatedDays: number;
  doneDays: number;
  partialDays: number;
  missedDays: number;
  shieldedDays: number;
  /** Anteil erledigter Tage an bewerteten Tagen (0..1). */
  completionRate: number;
  streak: StreakResult;
  ruleStats: RuleStat[];
  /** Tage bis zur 66-Tage-Schwelle (0 = erreicht). */
  daysToHabit: number;
}

export function computeStats(arc: Arc, log: ArcLog, today: ISODate): ArcStats {
  const totalDays = diffDays(arc.startDate, arc.endDate) + 1;
  const rawDay = diffDays(arc.startDate, today) + 1;
  const dayNumber = Math.max(0, rawDay);
  const started = rawDay >= 1;
  const finished = today > arc.endDate;
  const streak = computeStreak(arc, log, today);

  let doneDays = 0;
  let partialDays = 0;
  let missedDays = 0;
  let shielded = 0;
  for (const s of Object.values(streak.statuses)) {
    if (s === 'done') doneDays++;
    else if (s === 'partial') partialDays++;
    else if (s === 'missed') missedDays++;
    else if (s === 'shielded') shielded++;
  }
  const evaluatedDays = doneDays + partialDays + missedDays + shielded;

  return {
    totalDays,
    dayNumber,
    // Inklusive heute; vor dem Start die volle Länge.
    daysLeft: started ? Math.max(0, diffDays(today, arc.endDate) + 1) : totalDays,
    started,
    finished,
    evaluatedDays,
    doneDays,
    partialDays,
    missedDays,
    shieldedDays: shielded,
    completionRate: evaluatedDays ? doneDays / evaluatedDays : 0,
    streak,
    ruleStats: arc.rules.map((r) => ruleStat(arc, log, r, today)),
    daysToHabit: Math.max(0, HABIT_THRESHOLD_DAYS - streak.current),
  };
}

function ruleStat(arc: Arc, log: ArcLog, rule: Rule, today: ISODate): RuleStat {
  const from = maxISO(arc.startDate, rule.activeFrom);
  const lastRuleDay = rule.removedOn ? addDays(rule.removedOn, -1) : arc.endDate;
  const to = minISO(minISO(arc.endDate, lastRuleDay), today);
  if (to < from) return { rule, consistency: 0, hits: 0, expected: 0 };

  const days = rangeDays(from, to);
  const hitOn = (d: ISODate) => isValueDone(rule, ruleValue(log, d, rule.id));

  if (rule.frequency.kind === 'daily') {
    // Heute zählt nur, wenn bereits erledigt.
    const counted = days.filter((d) => d !== today || hitOn(d));
    const hits = counted.filter(hitOn).length;
    const expected = counted.length;
    return { rule, hits, expected, consistency: expected ? hits / expected : 0 };
  }

  // Wöchentlich: pro Woche max. `times` Treffer; laufende Woche anteilig.
  const times = rule.frequency.times;
  const byWeek = new Map<ISODate, { hits: number; days: number }>();
  for (const d of days) {
    const wk = weekStart(d);
    const e = byWeek.get(wk) ?? { hits: 0, days: 0 };
    e.days++;
    if (hitOn(d)) e.hits++;
    byWeek.set(wk, e);
  }
  let hits = 0;
  let expected = 0;
  const currentWeek = weekStart(today);
  for (const [wk, e] of byWeek) {
    const cappedHits = Math.min(e.hits, times);
    if (wk === currentWeek && cappedHits < times) {
      // Laufende Woche noch nicht fertig: nur zählen, was schon da ist.
      hits += cappedHits;
      expected += cappedHits;
      continue;
    }
    // Angebrochene Wochen am Rand anteilig erwarten.
    const exp = Math.min(times, Math.ceil((times * e.days) / 7));
    hits += Math.min(cappedHits, exp);
    expected += exp;
  }
  return { rule, hits, expected, consistency: expected ? hits / expected : 0 };
}

/** Wie oft wurde eine wöchentliche Regel in der Woche von `date` erfüllt? */
export function weeklyCount(arc: Arc, log: ArcLog, rule: Rule, date: ISODate): number {
  const start = maxISO(weekStart(date), arc.startDate);
  const end = minISO(addDays(weekStart(date), 6), arc.endDate);
  if (end < start) return 0;
  return rangeDays(start, end).filter((d) => isValueDone(rule, ruleValue(log, d, rule.id)))
    .length;
}

/** Phase des Arcs – Oktober aufbauen, November festigen, Dezember durchhalten. */
export function arcPhase(stats: ArcStats): { title: string; hint: string } {
  if (!stats.started) return { title: 'Bereit machen', hint: 'Dein Arc startet bald. Regeln prüfen, Umgebung vorbereiten.' };
  if (stats.finished) return { title: 'Geschafft', hint: 'Dein Arc ist vorbei. Schau zurück, was du aufgebaut hast.' };
  const third = stats.totalDays / 3;
  if (stats.dayNumber <= 7) return { title: 'Einstieg', hint: 'Die erste Woche ist die schwerste. Klein anfangen, jeden Tag erscheinen.' };
  if (stats.dayNumber <= third) return { title: 'Aufbauen', hint: 'Routine festigen: gleiche Zeit, gleicher Ort, gleicher Auslöser.' };
  if (stats.dayNumber <= third * 2) return { title: 'Festigen', hint: 'Die Motivation vom Start ist weg – jetzt trägt die Gewohnheit.' };
  return { title: 'Durchziehen', hint: 'Feiertage kommen. Plane voraus, statt zu verhandeln.' };
}

export function uid(): string {
  // RFC4122 v4 – reicht lokal und ist später Supabase-kompatibel (uuid).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface WeekSummary {
  week: ISODate; // Montag
  index: number; // 1-basiert innerhalb des Arcs
  days: { date: ISODate; status: DayStatus }[]; // nur Tage im Arc
  held: number;
  evaluated: number;
  rules: { rule: Rule; hits: number; expected: number }[];
  /** Woche ist vorbei (Sonntag liegt vor heute). */
  complete: boolean;
}

/** Alle Wochen (Montage) des Arcs. */
export function arcWeeks(arc: Arc): ISODate[] {
  const out: ISODate[] = [];
  for (let w = weekStart(arc.startDate); w <= arc.endDate; w = addDays(w, 7)) out.push(w);
  return out;
}

export function weekSummary(arc: Arc, log: ArcLog, week: ISODate, today: ISODate): WeekSummary {
  const { statuses } = computeStreak(arc, log, today);
  const days = rangeDays(week, addDays(week, 6))
    .filter((d) => d >= arc.startDate && d <= arc.endDate)
    .map((date) => ({ date, status: statuses[date] }));
  const held = days.filter((d) => d.status === 'done').length;
  const evaluated = days.filter((d) => ['done', 'partial', 'missed', 'shielded'].includes(d.status)).length;
  const elapsed = days.filter((d) => d.date <= today);

  const rules = arc.rules
    .filter((r) => elapsed.some((d) => isRuleActiveOn(r, d.date)))
    .map((rule) => {
      const active = elapsed.filter((d) => isRuleActiveOn(rule, d.date));
      const hits = active.filter((d) => isValueDone(rule, ruleValue(log, d.date, rule.id))).length;
      const expected =
        rule.frequency.kind === 'daily'
          ? active.filter((d) => d.date < today || isValueDone(rule, ruleValue(log, d.date, rule.id))).length
          : Math.min(rule.frequency.times, Math.ceil((rule.frequency.times * days.filter((d) => isRuleActiveOn(rule, d.date)).length) / 7));
      return { rule, hits: rule.frequency.kind === 'weekly' ? Math.min(hits, expected) : hits, expected };
    });

  return {
    week,
    index: Math.floor(diffDays(weekStart(arc.startDate), week) / 7) + 1,
    days,
    held,
    evaluated,
    rules,
    complete: addDays(week, 6) < today || days[days.length - 1]?.date < today,
  };
}

/** Welche Woche wird standardmässig reflektiert? Mo/Di: die vergangene, sonst die laufende. */
export function defaultReviewWeek(today: ISODate): ISODate {
  return weekdayIndex(today) <= 1 ? addDays(weekStart(today), -7) : weekStart(today);
}

/** Ist ein Wochenrückblick fällig? (Sonntag für die laufende, Mo/Di für die vergangene Woche) */
export function dueReviewWeek(arc: Arc, today: ISODate, reviewed: Record<ISODate, unknown>): ISODate | null {
  const wd = weekdayIndex(today);
  if (wd !== 6 && wd > 1) return null;
  const week = defaultReviewWeek(today);
  if (reviewed[week]) return null;
  if (addDays(week, 6) < arc.startDate || week > arc.endDate) return null;
  return week;
}
