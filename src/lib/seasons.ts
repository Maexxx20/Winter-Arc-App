/**
 * Saisons (getestet): Das Jahr in vier Arcs, damit Crews gemeinsam starten können.
 * Der Winter Arc bleibt der Klassiker (1. Oktober bis Silvester).
 */

import { t } from '@/i18n';

import { addDays, diffDays, type ISODate, parseISO } from './date';

export type SeasonId = 'newyear' | 'spring' | 'summer' | 'winter';

export interface SeasonDef {
  id: SeasonId;
  title: string;
  icon: string;
  /** Monat (1–12) und Tag des Starts bzw. Endes */
  start: [number, number];
  end: [number, number];
}

export const SEASONS: SeasonDef[] = [
  { id: 'newyear', title: 'New Year Arc', icon: '🎆', start: [1, 1], end: [3, 31] },
  { id: 'spring', title: 'Spring Arc', icon: '🌱', start: [4, 1], end: [6, 30] },
  { id: 'summer', title: 'Summer Arc', icon: '☀️', start: [7, 1], end: [9, 30] },
  { id: 'winter', title: 'Winter Arc', icon: '❄️', start: [10, 1], end: [12, 31] },
];

/** Kurzer Werbetext einer Saison in der aktuellen Sprache (Titel bleiben englisch). */
export function seasonPitch(season: SeasonDef): string {
  return t(`today.seasons.${season.id}`);
}

export interface SeasonInstance {
  season: SeasonDef;
  title: string;
  startDate: ISODate;
  endDate: ISODate;
  /** Tage insgesamt */
  totalDays: number;
}

const iso = (y: number, [m, d]: [number, number]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function seasonInstance(season: SeasonDef, year: number): SeasonInstance {
  const startDate = iso(year, season.start);
  const endDate = iso(year, season.end);
  return { season, title: `${season.title} ${year}`, startDate, endDate, totalDays: diffDays(startDate, endDate) + 1 };
}

/** Die Saison, in der `date` liegt. */
export function currentSeason(date: ISODate): SeasonInstance {
  const year = parseISO(date).getFullYear();
  for (const s of SEASONS) {
    const inst = seasonInstance(s, year);
    if (date >= inst.startDate && date <= inst.endDate) return inst;
  }
  return seasonInstance(SEASONS[0], year); // nicht erreichbar: die Saisons decken das Jahr ab
}

/** Die nächste Saison nach der, in der `date` liegt. */
export function nextSeason(date: ISODate): SeasonInstance {
  return currentSeason(addDays(currentSeason(date).endDate, 1));
}

export interface SeasonOption extends SeasonInstance {
  /** Ab wann man mitmacht (heute bei laufender Saison) */
  joinDate: ISODate;
  daysLeft: number;
  running: boolean;
}

/**
 * Welche Saisons man jetzt wählen kann: die laufende (wenn noch mind. 21 Tage bleiben)
 * und die nächste.
 */
export function seasonOptions(today: ISODate, minDays = 21): SeasonOption[] {
  const out: SeasonOption[] = [];
  const cur = currentSeason(today);
  const left = diffDays(today, cur.endDate) + 1;
  if (left >= minDays) {
    const running = today > cur.startDate;
    out.push({ ...cur, joinDate: running ? today : cur.startDate, daysLeft: left, running });
  }
  const next = nextSeason(today);
  out.push({ ...next, joinDate: next.startDate, daysLeft: next.totalDays, running: false });
  return out;
}

/** Vorschlag für den Namen eines eigenen Arcs. */
export function customArcTitle(days: number): string {
  return t('today.seasons.customTitle', { days });
}
