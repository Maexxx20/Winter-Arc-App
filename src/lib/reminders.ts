/**
 * Plant die lokalen Erinnerungen für die nächsten Tage (reine Funktion, getestet).
 *
 * Statt einer statischen täglichen Wiederholung planen wir konkrete Termine für
 * die nächsten Tage. So kann jede Nachricht den richtigen Inhalt haben
 * (Tag 24 von 92, "Gestern verpasst …") und die Abend-Erinnerung entfällt,
 * sobald der Tag gehalten ist. Neu geplant wird bei jeder Änderung und beim
 * Öffnen der App.
 */

import { t, tl } from '@/i18n';

import { activeRules, computeStreak, dayProgress, isValueDone, ruleValue, weeklyCount, type ArcLog } from './arc';
import { addDays, diffDays, type ISODate, parseISO, weekdayIndex } from './date';
import type { Arc, ReminderSettings, TimeOfDay } from './types';

export const PLAN_DAYS = 7;
export const MAX_PLANNED = 60;

export interface PlannedReminder {
  id: string;
  date: Date;
  title: string;
  body: string;
  url: string;
}

export function formatTime(time: TimeOfDay): string {
  const h = Math.floor(time / 60);
  const m = time % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function at(day: ISODate, time: TimeOfDay): Date {
  const d = parseISO(day);
  d.setHours(Math.floor(time / 60), time % 60, 0, 0);
  return d;
}

/** Spruch für den Morgen (wechselt täglich). */
function morningLine(dayNo: number): string {
  const lines = tl('system.reminders.morningLines');
  return lines[dayNo % lines.length] ?? '';
}

export function planReminders(
  arc: Arc,
  log: ArcLog,
  settings: ReminderSettings,
  now: Date,
  today: ISODate,
): PlannedReminder[] {
  if (!settings.enabled) return [];
  const out: PlannedReminder[] = [];
  const total = diffDays(arc.startDate, arc.endDate) + 1;
  const streak = computeStreak(arc, log, today);

  // Tag vor dem Start
  const eve = addDays(arc.startDate, -1);
  if (eve >= today && settings.evening !== null) {
    out.push({
      id: `start-eve-${arc.startDate}`,
      date: at(eve, settings.evening),
      title: t('system.reminders.startEveTitle'),
      body: t('system.reminders.startEveBody', { title: arc.title }),
      url: '/',
    });
  }

  for (let i = 0; i < PLAN_DAYS; i++) {
    const day = addDays(today, i);
    if (day < arc.startDate || day > arc.endDate) continue;
    const dayNo = diffDays(arc.startDate, day) + 1;
    const left = total - dayNo;

    if (settings.morning !== null) {
      const first = dayNo === 1;
      out.push({
        id: `morning-${day}`,
        date: at(day, settings.morning),
        title: first ? t('system.reminders.firstDayTitle') : t('system.reminders.dayTitle', { day: dayNo, total }),
        body: first ? t('system.reminders.firstDayBody', { title: arc.title }) : morningLine(dayNo),
        url: '/',
      });
    }

    if (settings.evening !== null) {
      let body: string;
      if (day === today) {
        const p = dayProgress(arc, log, day);
        if (p.total > 0 && p.done === p.total) continue; // schon gehalten → keine Abend-Erinnerung
        const open = p.total - p.done;
        body = t(streak.onThinIce ? 'system.reminders.eveningThinIce' : 'system.reminders.eveningOpen', { count: open });
      } else {
        body = t('system.reminders.eveningLater');
      }
      out.push({
        id: `evening-${day}`,
        date: at(day, settings.evening),
        title: left === 0 ? t('system.reminders.lastDayTitle') : t('system.reminders.checkInTitle'),
        body,
        url: '/',
      });
    }

    // Eigene Erinnerungen pro Regel – heute nur, wenn die Regel noch offen ist
    for (const rule of activeRules(arc, day)) {
      if (rule.reminder === undefined) continue;
      let body: string;
      if (rule.frequency.kind === 'weekly') {
        const left = rule.frequency.times - weeklyCount(arc, log, rule, day);
        // Wochenziel erreicht: an keinem Tag dieser Woche mehr erinnern (die Zahl kann nur steigen)
        if (left <= 0 || (day === today && isValueDone(rule, ruleValue(log, day, rule.id)))) continue;
        body = t('ruleReminder.bodyWeekly', { title: rule.title, count: Math.max(1, left) });
      } else {
        if (day === today && isValueDone(rule, ruleValue(log, day, rule.id))) continue;
        body =
          rule.measure.kind === 'amount'
            ? t('ruleReminder.bodyAmount', { title: rule.title, target: rule.measure.target, unit: rule.measure.unit })
            : t('ruleReminder.body', { title: rule.title });
      }
      out.push({
        id: `rule-${rule.id}-${day}`,
        date: at(day, rule.reminder),
        title: t('ruleReminder.title', { icon: rule.icon, title: rule.title }),
        body,
        url: '/',
      });
    }

    // Wochenrückblick am Sonntag
    if (settings.weeklyReview && weekdayIndex(day) === 6 && dayNo >= 5) {
      const reviewAt = Math.max(settings.evening ?? 19 * 60, 18 * 60) + 30;
      out.push({
        id: `review-${day}`,
        date: at(day, Math.min(reviewAt, 23 * 60)),
        title: t('system.reminders.reviewTitle'),
        body: t('system.reminders.reviewBody'),
        url: '/rueckblick',
      });
    }
  }

  // iOS behält höchstens 64 geplante Mitteilungen – die nächsten 60 reichen.
  return out
    .filter((r) => r.date.getTime() > now.getTime() + 30_000)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_PLANNED);
}
