/**
 * Crew-Logik ohne Netzwerk (getestet): was wir von uns veröffentlichen und
 * wie die Rangliste sortiert wird.
 */

import { t } from '@/i18n';

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
  /** Nur bei Crew-Arcs: welcher Crew-Arc und welche seiner Regeln an dem Tag erledigt sind */
  crew_arc_id?: string | null;
  rules_done?: string[] | null;
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
    const isDone = (r: Arc['rules'][number]) => {
      const v = log[date]?.values[r.id] ?? 0;
      return r.measure.kind === 'check' ? v >= 1 : v >= r.measure.target;
    };
    const done = dayRules.filter(isDone).length;
    const crew = arc.crew
      ? {
          crew_arc_id: arc.crew.crewArcId,
          // Regeln aus der Vorlage (auch wöchentliche), die an diesem Tag erfüllt wurden
          rules_done: arc.rules
            .filter((r) => (!arc.crew!.ruleIds || arc.crew!.ruleIds.includes(r.id)) && date >= r.activeFrom && (!r.removedOn || date < r.removedOn) && isDone(r))
            .map((r) => r.id)
            .slice(0, 10),
        }
      : {};
    rows.push({
      ...crew,
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
  return t('crew.invite.message', {
    name: crew.name,
    code: crew.invite_code,
    link: `nordwand://crew/beitreten?code=${crew.invite_code}`,
  });
}

// ---------- Wochen-Challenges ----------

export type ChallengeKind = 'crew_total' | 'everyone';

export interface Challenge {
  crew_id: string;
  /** Montag der Woche */
  week: ISODate;
  kind: ChallengeKind;
  target: number;
  created_by: string | null;
}

export interface ChallengeProgress {
  /** crew_total: gehaltene Tage zusammen; everyone: Personen, die das Ziel erreicht haben */
  value: number;
  /** crew_total: Ziel in Tagen; everyone: Anzahl Personen */
  goal: number;
  done: boolean;
  /** Tag, an dem die Challenge geschafft wurde */
  doneOn: ISODate | null;
  perMember: { userId: string; days: number }[];
  /** Verbleibende Tage der Woche inkl. heute (0 = vorbei) */
  daysLeft: number;
}

export function challengeTitle(c: Pick<Challenge, 'kind' | 'target'>): string {
  return c.kind === 'crew_total'
    ? t('crew.challenge.titleTotal', { count: c.target })
    : t('crew.challenge.titleEveryone', { count: c.target });
}

export function defaultChallengeTarget(kind: ChallengeKind, memberCount: number): number {
  return kind === 'crew_total' ? Math.min(140, Math.max(1, memberCount * 5)) : 5;
}

/** Wer zählt mit? Alle, die in dieser Woche mindestens einmal etwas veröffentlicht haben. */
function weekParticipants(members: CrewMember[], rows: StatusRow[], week: ISODate): string[] {
  const end = addDays(week, 6);
  const active = new Set(rows.filter((r) => r.user_id && r.date >= week && r.date <= end).map((r) => r.user_id!));
  return members.map((m) => m.user_id).filter((id) => active.has(id));
}

export function challengeProgress(c: Challenge, members: CrewMember[], rows: StatusRow[], today: ISODate): ChallengeProgress {
  const days = Array.from({ length: 7 }, (_, i) => addDays(c.week, i));
  const people = weekParticipants(members, rows, c.week);
  const doneSet = new Set(rows.filter((r) => r.status === 'done').map((r) => `${r.user_id}|${r.date}`));
  const count = (userId: string, upTo: ISODate) => days.filter((d) => d <= upTo && doneSet.has(`${userId}|${d}`)).length;

  const reached = (upTo: ISODate) => {
    if (c.kind === 'crew_total') {
      const value = people.reduce((sum, u) => sum + count(u, upTo), 0);
      return { value, goal: c.target, done: value >= c.target };
    }
    const value = people.filter((u) => count(u, upTo) >= c.target).length;
    return { value, goal: people.length, done: people.length > 0 && value === people.length };
  };

  const last = days[6] < today ? days[6] : today;
  const now = reached(last);
  const doneOn = now.done ? (days.find((d) => d <= last && reached(d).done) ?? null) : null;
  return {
    ...now,
    doneOn,
    perMember: people.map((u) => ({ userId: u, days: count(u, last) })).sort((a, b) => b.days - a.days),
    daysLeft: today > days[6] ? 0 : Math.max(0, diffDays(today, days[6]) + 1),
  };
}

// ---------- Was läuft in der Crew ----------

export interface ProfileBadge {
  id: string;
  date: ISODate;
}

export type FeedItem =
  | { kind: 'badge'; date: ISODate; userId: string; badgeId: string }
  | { kind: 'joined'; date: ISODate; userId: string }
  | { kind: 'reactions'; date: ISODate; from: string; to: string; emojis: string[] }
  | { kind: 'crew_day'; date: ISODate; /** Tage in Folge (bis inkl. date) */ run: number }
  | { kind: 'challenge_done'; date: ISODate; challenge: Challenge };

const FEED_ORDER: Record<FeedItem['kind'], number> = { challenge_done: 0, crew_day: 1, badge: 2, joined: 3, reactions: 4 };

export function buildFeed(
  input: {
    members: CrewMember[];
    rows: StatusRow[];
    reactions: Reaction[];
    badges: Record<string, ProfileBadge[] | undefined>;
    challenges: Challenge[];
  },
  today: ISODate,
  days = 7,
): FeedItem[] {
  const since = addDays(today, -(days - 1));
  const inRange = (d: ISODate) => d >= since && d <= today;
  const items: FeedItem[] = [];
  const memberIds = new Set(input.members.map((m) => m.user_id));

  for (const m of input.members) {
    const joined = toLocalISO(m.joined_at);
    if (joined && inRange(joined)) items.push({ kind: 'joined', date: joined, userId: m.user_id });
    for (const b of input.badges[m.user_id] ?? []) {
      if (inRange(b.date)) items.push({ kind: 'badge', date: b.date, userId: m.user_id, badgeId: b.id });
    }
  }

  const grouped = new Map<string, { date: ISODate; from: string; to: string; emojis: string[] }>();
  for (const r of input.reactions) {
    if (!inRange(r.date) || !memberIds.has(r.from_user) || !memberIds.has(r.to_user)) continue;
    const key = `${r.date}|${r.from_user}|${r.to_user}`;
    const g = grouped.get(key) ?? { date: r.date, from: r.from_user, to: r.to_user, emojis: [] };
    g.emojis.push(r.emoji);
    grouped.set(key, g);
  }
  for (const g of grouped.values()) items.push({ kind: 'reactions', ...g });

  // Ganze Crew hat gehalten (mind. 2 Personen, alle, die an dem Tag schon dabei waren)
  // Aufeinanderfolgende Tage werden zu einem Eintrag zusammengefasst.
  if (input.members.length >= 2) {
    type Run = { date: ISODate; run: number };
    let run = null as Run | null;
    for (let d = since; d <= today; d = addDays(d, 1)) {
      const present = input.members.filter((m) => (toLocalISO(m.joined_at) ?? d) <= d);
      const all =
        present.length >= 2 &&
        present.every((m) => input.rows.some((r) => r.user_id === m.user_id && r.date === d && r.status === 'done'));
      if (all) run = { date: d, run: (run?.run ?? 0) + 1 };
      else if (run) {
        items.push({ kind: 'crew_day', ...run });
        run = null;
      }
    }
    if (run) items.push({ kind: 'crew_day', ...run });
  }

  for (const c of input.challenges) {
    const p = challengeProgress(c, input.members, input.rows, today);
    if (p.doneOn && inRange(p.doneOn)) items.push({ kind: 'challenge_done', date: p.doneOn, challenge: c });
  }

  return items
    .sort((a, b) => (a.date === b.date ? FEED_ORDER[a.kind] - FEED_ORDER[b.kind] : b.date.localeCompare(a.date)))
    .slice(0, 40);
}

/** Zeitstempel → lokales Datum (oder null, wenn leer/ungültig). */
function toLocalISO(ts: string): ISODate | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
