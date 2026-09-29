/**
 * Datums-Helfer auf Basis lokaler Kalendertage ("YYYY-MM-DD").
 *
 * Wir rechnen bewusst mit Strings statt Date-Objekten, damit Zeitzonen und
 * Sommerzeit-Umstellungen (Ende Oktober!) keine Tage verschieben.
 */

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

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export const weekdayShortNames = WEEKDAYS_SHORT;

/** "Mittwoch, 1. Oktober" */
export function formatLong(iso: ISODate): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[weekdayIndex(iso)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

/** "1. Okt 2026" */
export function formatShort(iso: ISODate, withYear = false): string {
  const d = parseISO(iso);
  const base = `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

/** "1.10.2026" */
export function formatNumeric(iso: ISODate): string {
  const d = parseISO(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export function monthName(iso: ISODate): string {
  return MONTHS[parseISO(iso).getMonth()];
}
