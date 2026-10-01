/**
 * Plant die lokalen Erinnerungen für die nächsten Tage (reine Funktion, getestet).
 *
 * Statt einer statischen täglichen Wiederholung planen wir konkrete Termine für
 * die nächsten Tage. So kann jede Nachricht den richtigen Inhalt haben
 * (Tag 24 von 92, "Gestern verpasst …") und die Abend-Erinnerung entfällt,
 * sobald der Tag gehalten ist. Neu geplant wird bei jeder Änderung und beim
 * Öffnen der App.
 */

import { t } from '@/i18n';

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

export function formatTime(t: TimeOfDay): string {
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function at(day: ISODate, t: TimeOfDay): Date {
  const d = parseISO(day);
  d.setHours(Math.floor(t / 60), t % 60, 0, 0);
  return d;
}

const MORNING_LINES = [
  'Ein Tag nach dem anderen. Heute zählt.',
  'Kein Verhandeln. Einfach anfangen.',
  'Die Wand wird nicht kleiner. Du wirst stärker.',
  'Disziplin ist, was du tust, wenn keiner zuschaut.',
  'Kleine Schritte, jeden Tag.',
  'Zeig dir heute, wer du sein willst.',
  'Motivation kommt und geht. Deine Regeln bleiben.',
];

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
      title: 'Morgen geht’s los',
      body: `Dein ${arc.title} startet morgen. Leg dir heute Abend alles bereit.`,
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
        title: first ? 'Tag 1. Los geht’s.' : `Tag ${dayNo} von ${total}`,
        body: first
          ? `Heute beginnt dein ${arc.title}. Du hast unterschrieben – jetzt zählt jeder Tag.`
          : MORNING_LINES[dayNo % MORNING_LINES.length],
        url: '/',
      });
    }

    if (settings.evening !== null) {
      let body: string;
      if (day === today) {
        const p = dayProgress(arc, log, day);
        if (p.total > 0 && p.done === p.total) continue; // schon gehalten → keine Abend-Erinnerung
        const open = p.total - p.done;
        body = streak.onThinIce
          ? `Gestern verpasst – heute nicht auch noch. Noch ${open} ${open === 1 ? 'Regel' : 'Regeln'} offen.`
          : `Noch ${open} ${open === 1 ? 'Regel' : 'Regeln'} offen. Du schaffst das.`;
      } else {
        body = 'Schon alles abgehakt? Noch ist Zeit.';
      }
      out.push({
        id: `evening-${day}`,
        date: at(day, settings.evening),
        title: left === 0 ? 'Letzter Tag deines Arcs' : 'Check-in',
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
        if (day === today && (left <= 0 || isValueDone(rule, ruleValue(log, day, rule.id)))) continue;
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
        title: 'Wochenrückblick',
        body: 'Zwei Minuten: Was lief gut, was nimmst du dir für nächste Woche vor?',
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
