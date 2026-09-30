/**
 * Crew-Logik ohne Netzwerk (getestet): was wir von uns veröffentlichen und
 * wie die Rangliste sortiert wird.
 */

import { computeStats, type ArcLog } from './arc';
import { addDays, diffDays, type ISODate } from './date';
import type { Arc, DayStatus } from './types';

export const REACTION_EMOJIS = ['🔥', '💪', '👏', '❄️', '🫡'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface Crew {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
}

export interface CrewMember {
  crew_id: string;
  user_id: string;
  display_name: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface StatusRow {
  user_id?: string;
  date: ISODate;
  status: Exclude<DayStatus, 'future' | 'outside'>;
  done: number;
  total: number;
  day_number: number;
  total_days: number;
  streak: number;
  best_streak: number;
  rate: number;
  updated_at?: string;
}

export interface Reaction {
  id: string;
  crew_id: string;
  from_user: string;
  to_user: string;
  date: ISODate;
  emoji: ReactionEmoji;
}

/** Tages-Zusammenfassungen für heute und die zwei Tage davor (nur Tage im Arc). */
export function buildStatusRows(arc: Arc, log: ArcLog, today: ISODate, back = 2): StatusRow[] {
  const stats = computeStats(arc, log, today);
  if (!stats.started) return [];
  const rows: StatusRow[] = [];
  for (let i = back; i >= 0; i--) {
    const date = addDays(today, -i);
    if (date < arc.startDate || date > arc.endDate) continue;
    const s = stats.streak.statuses[date];
    if (!s || s === 'future' || s === 'outside') continue;
    const dayRules = arc.rules.filter(
      (r) => r.frequency.kind === 'daily' && date >= r.activeFrom && (!r.removedOn || date < r.removedOn),
    );
    const done = dayRules.filter((r) => {
      const v = log[date]?.values[r.id] ?? 0;
      return r.measure.kind === 'check' ? v >= 1 : v >= r.measure.target;
    }).length;
    rows.push({
      date,
      status: s,
      done,
      total: dayRules.length,
      day_number: diffDays(arc.startDate, date) + 1,
      total_days: stats.totalDays,
      streak: stats.streak.current,
      best_streak: stats.streak.best,
      rate: Math.round(stats.completionRate * 100),
    });
  }
  return rows;
}

export interface RankedMember {
  member: CrewMember;
  latest: StatusRow | null;
  /** Status der letzten 7 Tage, ältester zuerst (undefined = keine Daten). */
  week: (StatusRow['status'] | undefined)[];
  /** Heute schon gehalten? */
  heldToday: boolean;
  /** Seit mehr als 2 Tagen nichts mehr veröffentlicht. */
  inactive: boolean;
  rank: number;
}

/** Rangliste: Quote, dann Streak, dann heute gehalten. Inaktive ans Ende. */
export function rankMembers(members: CrewMember[], rows: StatusRow[], today: ISODate): RankedMember[] {
  const byUser = new Map<string, StatusRow[]>();
  for (const r of rows) {
    if (!r.user_id) continue;
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  }
  const list = members.map((member) => {
    const own = (byUser.get(member.user_id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const latest = own[own.length - 1] ?? null;
    const week = Array.from({ length: 7 }, (_, i) => own.find((r) => r.date === addDays(today, i - 6))?.status);
    return {
      member,
      latest,
      week,
      heldToday: own.some((r) => r.date === today && r.status === 'done'),
      inactive: !latest || diffDays(latest.date, today) > 2,
      rank: 0,
    };
  });
  list.sort((a, b) => {
    if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
    const ra = a.latest?.rate ?? -1;
    const rb = b.latest?.rate ?? -1;
    if (ra !== rb) return rb - ra;
    const sa = a.latest?.streak ?? -1;
    const sb = b.latest?.streak ?? -1;
    if (sa !== sb) return sb - sa;
    if (a.heldToday !== b.heldToday) return a.heldToday ? -1 : 1;
    return a.member.display_name.localeCompare(b.member.display_name);
  });
  // Gleichstand = gleicher Rang
  list.forEach((m, i) => {
    const prev = list[i - 1];
    const same =
      prev &&
      !m.inactive &&
      !prev.inactive &&
      prev.latest?.rate === m.latest?.rate &&
      prev.latest?.streak === m.latest?.streak;
    m.rank = same ? prev.rank : i + 1;
  });
  return list;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function inviteMessage(crew: Pick<Crew, 'name' | 'invite_code'>): string {
  return (
    `Mach mit bei meiner Crew «${crew.name}» auf Nordwand – wir ziehen den Winter Arc zusammen durch. 🏔️\n\n` +
    `Code: ${crew.invite_code}\n` +
    `nordwand://crew/beitreten?code=${crew.invite_code}`
  );
}
