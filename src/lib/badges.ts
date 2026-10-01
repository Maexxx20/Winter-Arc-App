/**
 * Abzeichen – werden aus den vorhandenen Daten berechnet, nicht gespeichert.
 * Dadurch sind sie auf jedem Gerät gleich und können nicht «verloren» gehen.
 */

import { t } from '@/i18n';

import { type ArcLog, computeStreak, HABIT_THRESHOLD_DAYS } from './arc';
import { addDays, diffDays, type ISODate, minISO, rangeDays, toISO, weekStart } from './date';
import type { Arc, WeekReview } from './types';

export type BadgeId =
  | 'first_day'
  | 'streak_7'
  | 'streak_21'
  | 'streak_30'
  | 'streak_66'
  | 'perfect_week'
  | 'perfect_month'
  | 'shield'
  | 'comeback'
  | 'halfway'
  | 'journal_10'
  | 'review_4'
  | 'summit'
  | 'north_face';

export interface BadgeDef {
  id: BadgeId;
  /** Texte kommen aus den Übersetzungen (Getter, damit ein Sprachwechsel sofort greift). */
  readonly title: string;
  /** Kurz, für gesperrte Abzeichen im Raster. */
  readonly hint: string;
  readonly description: string;
  icon: string;
}

function badge(id: BadgeId, icon: string): BadgeDef {
  const vars = { count: HABIT_THRESHOLD_DAYS };
  return {
    id,
    icon,
    get title() {
      return t(`history.badge.${id}.title`, vars);
    },
    get hint() {
      return t(`history.badge.${id}.hint`, vars);
    },
    get description() {
      return t(`history.badge.${id}.description`, vars);
    },
  };
}

/** Reihenfolge = Anzeige im Profil (grob nach Schwierigkeit). */
export const BADGES: BadgeDef[] = [
  badge('first_day', '🥾'),
  badge('streak_7', '🔥'),
  badge('shield', '🛡️'),
  badge('perfect_week', '⭐'),
  badge('streak_21', '⛰️'),
  badge('comeback', '🔁'),
  badge('journal_10', '📓'),
  badge('review_4', '🪞'),
  badge('halfway', '⏳'),
  badge('streak_30', '🧗'),
  badge('perfect_month', '🌕'),
  badge('streak_66', '🧠'),
  badge('summit', '🏔️'),
  badge('north_face', '🏆'),
];

export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b])) as Record<BadgeId, BadgeDef>;

export interface EarnedBadge {
  id: BadgeId;
  arcId: string;
  /** Tag, an dem das Abzeichen verdient wurde. */
  date: ISODate;
}

export function badgeKey(b: Pick<EarnedBadge, 'id' | 'arcId'>): string {
  return `${b.id}@${b.arcId}`;
}

const STREAK_BADGES: [number, BadgeId][] = [
  [7, 'streak_7'],
  [21, 'streak_21'],
  [30, 'streak_30'],
  [HABIT_THRESHOLD_DAYS, 'streak_66'],
];

/** Alle Abzeichen eines Arcs, die bis `today` verdient sind. */
export function arcBadges(arc: Arc, log: ArcLog, reviews: Record<ISODate, WeekReview>, today: ISODate): EarnedBadge[] {
  if (today < arc.startDate) return [];
  const earned = new Map<BadgeId, ISODate>();
  const earn = (id: BadgeId, date: ISODate) => {
    if (date <= today && !earned.has(id)) earned.set(id, date);
  };

  const { statuses } = computeStreak(arc, log, today);
  const days = rangeDays(arc.startDate, arc.endDate);

  // Streak Tag für Tag nachspielen (gleiche Regeln wie computeStreak).
  let current = 0;
  let broken = false; // gab es schon einen Bruch?
  let everBroken = false;
  for (const d of days) {
    const s = statuses[d];
    if (s === 'done') {
      current++;
      if (current === 1) earn('first_day', d);
      for (const [n, id] of STREAK_BADGES) if (current === n) earn(id, d);
      if (broken && current === 7) earn('comeback', d);
    } else if (s === 'shielded') {
      earn('shield', d);
    } else if (s === 'missed' || s === 'partial') {
      if (current > 0) broken = true;
      current = 0;
      everBroken = true;
    }
  }

  // Perfekte Woche: Mo–So komplett im Arc und jeder Tag «done».
  for (let wk = weekStart(arc.startDate); wk <= arc.endDate; wk = addDays(wk, 7)) {
    if (wk < arc.startDate) continue;
    const week = rangeDays(wk, addDays(wk, 6));
    if (week[6] > arc.endDate) break;
    if (week.every((d) => statuses[d] === 'done')) earn('perfect_week', week[6]);
  }

  // Perfekter Monat: ganzer Kalendermonat im Arc und jeder Tag «done».
  for (let d = arc.startDate; d <= arc.endDate; d = addDays(d, 1)) {
    if (!d.endsWith('-01')) continue;
    const next = `${d.slice(0, 5)}${String(Number(d.slice(5, 7)) + 1).padStart(2, '0')}-01`;
    const last = d.slice(5, 7) === '12' ? `${d.slice(0, 4)}-12-31` : addDays(next, -1);
    if (last > arc.endDate) break;
    if (rangeDays(d, last).every((x) => statuses[x] === 'done')) earn('perfect_month', last);
  }

  // Halbzeit
  const total = diffDays(arc.startDate, arc.endDate) + 1;
  earn('halfway', addDays(arc.startDate, Math.ceil(total / 2) - 1));

  // Tagebuch: 10. Tag mit Notiz
  const noteDays = days.filter((d) => log[d]?.note?.trim());
  if (noteDays.length >= 10) earn('journal_10', noteDays[9]);

  // Wochenrückblicke: 4. Rückblick (zählt am Sonntag der Woche)
  const reviewWeeks = Object.keys(reviews).sort();
  if (reviewWeeks.length >= 4) earn('review_4', addDays(reviewWeeks[3], 6));

  // Am Ende des Arcs
  if (today > arc.endDate) {
    const evaluated = days.filter((d) => ['done', 'partial', 'missed', 'shielded'].includes(statuses[d]));
    const done = evaluated.filter((d) => statuses[d] === 'done').length;
    if (evaluated.length && done / evaluated.length >= 0.8) earn('summit', arc.endDate);
    if (!everBroken && done > 0) earn('north_face', arc.endDate);
  }

  return BADGES.filter((b) => earned.has(b.id)).map((b) => ({ id: b.id, arcId: arc.id, date: earned.get(b.id)! }));
}

/** Abzeichen über alle Arcs (abgebrochene Arcs zählen bis zum Abbruch mit). */
export function allBadges(
  arcs: Arc[],
  logs: Record<string, ArcLog>,
  reviews: Record<string, Record<ISODate, WeekReview>>,
  today: ISODate,
): EarnedBadge[] {
  return arcs.flatMap((a) => {
    // Abgebrochene Arcs zählen nur bis zum Tag des Abbruchs.
    const until = a.status === 'abandoned' && a.updatedAt ? minISO(today, toISO(new Date(a.updatedAt))) : today;
    return arcBadges(a, logs[a.id] ?? {}, reviews[a.id] ?? {}, until);
  });
}

/** Pro Abzeichen: wie oft verdient und wann zum ersten Mal. */
export function badgeSummary(earned: EarnedBadge[]): Map<BadgeId, { count: number; first: ISODate }> {
  const out = new Map<BadgeId, { count: number; first: ISODate }>();
  for (const e of earned) {
    const cur = out.get(e.id);
    if (!cur) out.set(e.id, { count: 1, first: e.date });
    else out.set(e.id, { count: cur.count + 1, first: e.date < cur.first ? e.date : cur.first });
  }
  return out;
}

/** Neue Abzeichen zum Feiern: noch nicht gesehen und frisch (heute oder gestern verdient). */
export function freshBadges(earned: EarnedBadge[], seen: string[], today: ISODate): EarnedBadge[] {
  const s = new Set(seen);
  return earned.filter((e) => !s.has(badgeKey(e)) && e.date >= addDays(today, -1));
}
