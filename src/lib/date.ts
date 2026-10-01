/**
 * Datums-Helfer auf Basis lokaler Kalendertage ("YYYY-MM-DD").
 *
 * Wir rechnen bewusst mit Strings statt Date-Objekten, damit Zeitzonen und
 * Sommerzeit-Umstellungen (Ende Oktober!) keine Tage verschieben.
 */

import { t, tl } from '@/i18n';

export type ISODate = string; // "YYYY-MM-DD"

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Heute als lokaler Kalendertag. `rolloverHour` erlaubt z. B. "Tag endet um 3 Uhr". */
export function todayISO(now: Date = new Date(), rolloverHour = 0): ISODate {
  const d = new Date(now.getTime());
  if (d.getHours() < rolloverHour) d.setDate(d.getDate() - 1);
  return toISO(d);
}

/** Parst als lokalen Mittag, damit DST-Sprünge nie den Tag wechseln. */
export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Anzahl Tage von a nach b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Montag der Woche (ISO-Woche, Montag = Wochenstart). */
export function weekStart(iso: ISODate): ISODate {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = Montag
  return addDays(iso, -dow);
}

/** 0 = Montag … 6 = Sonntag */
export function weekdayIndex(iso: ISODate): number {
  return (parseISO(iso).getDay() + 6) % 7;
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toISO(parseISO(iso)) === iso;
}

export function rangeDays(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const n = diffDays(start, end);
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}
export function maxISO(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

// Namen und Formate kommen aus den Übersetzungen (Deutsch, Englisch, Französisch, Italienisch).

/** Kurze Wochentage, Montag zuerst («Mo», «Mon», «lu» …) */
export function weekdayShortNames(): readonly string[] {
  return tl('date.weekdaysShort');
}

export function weekdayName(index: number): string {
  return tl('date.weekdays')[index] ?? '';
}

/** "Mittwoch, 1. Oktober" */
export function formatLong(iso: ISODate): string {
  const d = parseISO(iso);
  return t('date.long', { weekday: weekdayName(weekdayIndex(iso)), day: d.getDate(), month: tl('date.months')[d.getMonth()] });
}

/** "1. Okt 2026" */
export function formatShort(iso: ISODate, withYear = false): string {
  const d = parseISO(iso);
  const base = t('date.short', { day: d.getDate(), month: tl('date.monthsShort')[d.getMonth()] });
  return withYear ? t('date.withYear', { date: base, year: d.getFullYear() }) : base;
}

/** "1.10.2026" */
export function formatNumeric(iso: ISODate): string {
  const d = parseISO(iso);
  return t('date.numeric', { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() });
}

export function monthName(iso: ISODate): string {
  return tl('date.months')[parseISO(iso).getMonth()] ?? '';
}
