/**
 * Arc-Rückblick (getestet): die Zahlen für die Karten am Ende eines Arcs –
 * gehaltene Tage, bester Streak, stärkste und schwierigste Regel, Mengen, beste Woche.
 */

import { type ArcLog, computeStats, isRuleActiveOn } from './arc';
import { arcBadges } from './badges';
import { diffDays, type ISODate, minISO, toISO, weekdayIndex, weekStart } from './date';
import { type DiaryPhoto, diaryPhotos } from './photo-merge';
import { ruleDetail } from './rule-stats';
import type { Arc, Rule, WeekReview } from './types';

export interface RecapRule {
  rule: Rule;
  rate: number;
  hits: number;
  expected: number;
}

export interface ArcRecap {
  title: string;
  startDate: ISODate;
  endDate: ISODate;
  /** Arc ist vorbei (sonst Zwischenstand) */
  finished: boolean;
  totalDays: number;
  /** Bis heute gezählte Tage */
  evaluatedDays: number;
  heldDays: number;
  rate: number;
  bestStreak: number;
  currentStreak: number;
  shieldedDays: number;
  strongest: RecapRule | null;
  hardest: RecapRule | null;
  /** 0 = Montag; nur mit genug Daten */
  hardestWeekday: number | null;
  bestWeekday: number | null;
  /** Beste Woche (1-basiert im Arc) */
  bestWeek: { index: number; held: number; days: number } | null;
  /** Summen der Mengen-Regeln, grösste zuerst */
  amounts: { rule: Rule; total: number; unit: string }[];
  notes: number;
  photos: number;
  badges: number;
  /** Erstes und letztes Tagebuch-Foto (an verschiedenen Tagen) für Vorher/Nachher */
  progress: { first: DiaryPhoto; last: DiaryPhoto } | null;
}

export function buildRecap(
  arc: Arc,
  log: ArcLog,
  reviews: Record<ISODate, WeekReview>,
  today: ISODate,
): ArcRecap {
  // Abgebrochener Arc: nur bis zum Abbruch zählen
  if (arc.status === 'abandoned' && arc.updatedAt) today = minISO(today, toISO(new Date(arc.updatedAt)));
  const stats = computeStats(arc, log, today);
  const end = minISO(arc.endDate, today);

  // Regeln: Quote über den ganzen Arc
  const rules: RecapRule[] = arc.rules
    .map((rule) => {
      const d = ruleDetail(arc, log, rule, today);
      return { rule, rate: d.rate, hits: d.hits, expected: d.expected };
    })
    .filter((r) => r.expected >= 3);
  const sorted = [...rules].sort((a, b) => b.rate - a.rate || b.hits - a.hits);
  const strongest = sorted[0] ?? null;
  const hardest = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  // Wochentage: Anteil gehaltener Tage
  const perWeekday = Array.from({ length: 7 }, () => ({ held: 0, days: 0 }));
  // Wochen: gehaltene Tage pro Arc-Woche
  const perWeek = new Map<ISODate, { held: number; days: number }>();
  for (const [date, status] of Object.entries(stats.streak.statuses)) {
    if (!['done', 'partial', 'missed', 'shielded'].includes(status)) continue;
    const w = perWeekday[weekdayIndex(date)];
    w.days++;
    const wk = weekStart(date);
    const e = perWeek.get(wk) ?? { held: 0, days: 0 };
    e.days++;
    if (status === 'done') {
      w.held++;
      e.held++;
    }
    perWeek.set(wk, e);
  }
  const ranked = perWeekday
    .map((w, i) => ({ i, rate: w.days ? w.held / w.days : 0, days: w.days }))
    .filter((w) => w.days >= 2);
  const spread = ranked.length >= 3 ? Math.max(...ranked.map((w) => w.rate)) - Math.min(...ranked.map((w) => w.rate)) : 0;
  const hardestWeekday = spread > 0 ? [...ranked].sort((a, b) => a.rate - b.rate)[0].i : null;
  const bestWeekday = spread > 0 ? [...ranked].sort((a, b) => b.rate - a.rate)[0].i : null;

  const firstWeek = weekStart(arc.startDate);
  let bestWeek: ArcRecap['bestWeek'] = null;
  for (const [wk, e] of [...perWeek.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!bestWeek || e.held > bestWeek.held) {
      bestWeek = { index: Math.floor(diffDays(firstWeek, wk) / 7) + 1, held: e.held, days: e.days };
    }
  }
  if (bestWeek && bestWeek.held === 0) bestWeek = null;

  // Mengen
  const amounts = arc.rules
    .filter((r) => r.measure.kind === 'amount')
    .map((rule) => {
      let total = 0;
      for (const [date, entry] of Object.entries(log)) {
        if (date < arc.startDate || date > end || !isRuleActiveOn(rule, date)) continue;
        total += entry.values[rule.id] ?? 0;
      }
      return { rule, total: Math.round(total * 100) / 100, unit: rule.measure.kind === 'amount' ? rule.measure.unit : '' };
    })
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);

  const inArc = Object.entries(log).filter(([d]) => d >= arc.startDate && d <= end);
  const arcPhotos = diaryPhotos({ logs: { [arc.id]: log } }).filter((p) => p.date >= arc.startDate && p.date <= end);
  const firstPhoto = arcPhotos[0];
  const lastPhoto = arcPhotos[arcPhotos.length - 1];

  return {
    title: arc.title,
    startDate: arc.startDate,
    endDate: arc.endDate,
    // Abgebrochene oder beendete Arcs sind fertig – nicht weiter verpasste Tage zählen
    finished: today > arc.endDate || arc.status !== 'active',
    totalDays: stats.totalDays,
    evaluatedDays: stats.evaluatedDays,
    heldDays: stats.doneDays,
    rate: stats.completionRate,
    bestStreak: stats.streak.best,
    currentStreak: stats.streak.current,
    shieldedDays: stats.shieldedDays,
    strongest,
    hardest: hardest && strongest && hardest.rule.id !== strongest.rule.id && hardest.rate < strongest.rate ? hardest : null,
    hardestWeekday,
    bestWeekday,
    bestWeek,
    amounts,
    notes: inArc.filter(([, e]) => e.note?.trim()).length,
    photos: inArc.reduce((n, [, e]) => n + (e.photos?.length ?? 0), 0),
    badges: arcBadges(arc, log, reviews, today).length,
    progress: firstPhoto && lastPhoto && firstPhoto.date !== lastPhoto.date ? { first: firstPhoto, last: lastPhoto } : null,
  };
}
