import { buildStatusRows, type Challenge, type ChallengeKind, type Crew, type CrewMember, normalizeCode, type Reaction, type ReactionEmoji, type StatusRow } from '@/lib/crew';
import type { CrewArc, CrewArcSignature } from '@/lib/crew-arc';
import { addDays, type ISODate, todayISO, weekStart } from '@/lib/date';
import { t } from '@/i18n';
import { getState, selectActiveArc, selectLog } from '@/store/store';

import { avatarUrls, fetchProfiles, type PublicProfile } from './profile';
import { getSession, supabase } from './supabase';

export type CrewWithCount = Crew & { member_count: number };

export interface CrewDetail {
  crew: Crew;
  members: CrewMember[];
  rows: StatusRow[];
  reactions: Reaction[];
  /** user_id → Profil (Bild, Motto, Instagram, Abzeichen) */
  profiles: Record<string, PublicProfile>;
  /** Challenges dieser und der letzten Woche */
  challenges: Challenge[];
}

/** Zuletzt geladene Crews – damit Profile sofort erscheinen. */
const detailCache = new Map<string, CrewDetail>();
export function cachedCrew(crewId: string): CrewDetail | undefined {
  return detailCache.get(crewId);
}

function translate(message: string): string {
  if (message.includes('removed_from_crew')) return t('crewx.errors.removed');
  if (message.includes('not_owner')) return t('crewx.errors.notOwner');
  if (message.includes('already_done')) return t('crewx.errors.alreadyDone');
  if (message.includes('blocked')) return t('crewx.errors.blocked');
  if (message.includes('crew_not_found')) return t('crew.errors.notFound');
  if (message.includes('crew_full')) return t('crew.errors.full');
  if (message.includes('too_many_crews')) return t('crew.errors.tooMany');
  if (message.includes('not_authenticated')) return t('common.signInFirst');
  if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) return t('common.offline');
  return message;
}

function need() {
  if (!supabase || !getSession()) throw new Error(t('common.signInFirst'));
  return supabase;
}

function displayName(): string {
  return getState().settings.name.trim() || t('common.noName');
}

/** Eigene Tages-Zusammenfassungen hochladen (heute + 2 Tage zurück). */
export async function publishStatus(): Promise<void> {
  const session = getSession();
  if (!supabase || !session) return;
  const s = getState();
  const arc = selectActiveArc(s);
  if (!arc) return;
  const today = todayISO(new Date(), s.settings.rolloverHour);
  const rows = buildStatusRows(arc, selectLog(s, arc.id), today).map((r) => ({
    ...r,
    user_id: session.user.id,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  let { error } = await supabase.from('daily_status').upsert(rows, { onConflict: 'user_id,date' });
  if (error && /crew_arc_id|rules_done/.test(error.message)) {
    // Migration 0011 noch nicht ausgeführt: ohne Crew-Arc-Felder
    ({ error } = await supabase
      .from('daily_status')
      .upsert(rows.map(({ crew_arc_id: _a, rules_done: _b, ...r }) => r), { onConflict: 'user_id,date' }));
  }
  if (error) throw new Error(`daily_status: ${error.message}`);
}

export async function listCrews(): Promise<CrewWithCount[]> {
  const sb = need();
  const { data, error } = await sb.from('crews').select('id, name, invite_code, created_by, crew_members(count)').order('created_at');
  if (error) throw new Error(translate(error.message));
  return (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    invite_code: c.invite_code,
    created_by: c.created_by,
    member_count: c.crew_members?.[0]?.count ?? 0,
  }));
}

export async function loadCrew(crewId: string, today: ISODate): Promise<CrewDetail> {
  const sb = need();
  // Ab Montag der Vorwoche – für die Challenge der letzten Woche und den Verlauf.
  const since = addDays(weekStart(today), -7);
  const [crewRes, membersRes, reactionsRes, challengesRes] = await Promise.all([
    sb.from('crews').select('id, name, invite_code, created_by').eq('id', crewId).single(),
    sb.from('crew_members').select('*').eq('crew_id', crewId).order('joined_at'),
    sb.from('reactions').select('id, crew_id, from_user, to_user, date, emoji').eq('crew_id', crewId).gte('date', addDays(today, -6)),
    sb.from('crew_challenges').select('crew_id, week, kind, target, created_by').eq('crew_id', crewId).gte('week', since),
  ]);
  if (crewRes.error) throw new Error(translate(crewRes.error.message));
  if (membersRes.error) throw new Error(translate(membersRes.error.message));
  if (reactionsRes.error) throw new Error(translate(reactionsRes.error.message));
  const members = (membersRes.data ?? []) as CrewMember[];

  const ids = members.map((m) => m.user_id);
  const [{ data: rows, error }, profiles] = await Promise.all([
    sb.from('daily_status').select('*').in('user_id', ids).gte('date', since),
    fetchProfiles(ids),
  ]);
  if (error) throw new Error(translate(error.message));
  // Bild-Links gleich mitholen, damit die Liste nicht flackert.
  await avatarUrls(Object.values(profiles).map((p) => p.avatar_path)).catch(() => undefined);

  const detail: CrewDetail = {
    crew: crewRes.data as Crew,
    members,
    rows: (rows ?? []) as StatusRow[],
    reactions: (reactionsRes.data ?? []) as Reaction[],
    profiles,
    // Fehlt die Tabelle (Migration 0005 noch nicht ausgeführt), einfach ohne Challenges.
    challenges: challengesRes.error ? [] : ((challengesRes.data ?? []) as Challenge[]),
  };
  detailCache.set(crewId, detail);
  return detail;
}

export async function createCrew(name: string): Promise<Crew> {
  const sb = need();
  await publishStatus().catch(() => {});
  const { data, error } = await sb.rpc('create_crew', { p_name: name.trim(), p_display_name: displayName() });
  if (error) throw new Error(translate(error.message));
  return data as Crew;
}

export async function joinCrew(code: string): Promise<Crew> {
  const sb = need();
  await publishStatus().catch(() => {});
  const { data, error } = await sb.rpc('join_crew', { p_code: normalizeCode(code), p_display_name: displayName() });
  if (error) throw new Error(translate(error.message));
  return data as Crew;
}

export async function leaveCrew(crewId: string): Promise<void> {
  const sb = need();
  const { error } = await sb.rpc('leave_crew', { p_crew: crewId });
  if (error) throw new Error(translate(error.message));
}

export async function renameMe(crewId: string, name: string): Promise<void> {
  const sb = need();
  const { error } = await sb
    .from('crew_members')
    .update({ display_name: name.trim() })
    .eq('crew_id', crewId)
    .eq('user_id', getSession()!.user.id);
  if (error) throw new Error(translate(error.message));
}

export async function saveChallenge(crewId: string, week: ISODate, kind: ChallengeKind, target: number, existing: boolean): Promise<void> {
  const sb = need();
  const { error } = existing
    ? await sb.from('crew_challenges').update({ kind, target }).eq('crew_id', crewId).eq('week', week)
    : await sb.from('crew_challenges').insert({ crew_id: crewId, week, kind, target, created_by: getSession()!.user.id });
  if (error) {
    if (error.message.includes('duplicate')) throw new Error(t('crew.errors.challengeExists'));
    throw new Error(translate(error.message));
  }
}

export async function deleteChallenge(crewId: string, week: ISODate): Promise<void> {
  const sb = need();
  const { error } = await sb.from('crew_challenges').delete().eq('crew_id', crewId).eq('week', week);
  if (error) throw new Error(translate(error.message));
}

export async function addReaction(crewId: string, toUser: string, date: ISODate, emoji: ReactionEmoji): Promise<Reaction> {
  const sb = need();
  const { data, error } = await sb
    .from('reactions')
    .insert({ crew_id: crewId, to_user: toUser, date, emoji, from_user: getSession()!.user.id })
    .select('id, crew_id, from_user, to_user, date, emoji')
    .single();
  if (error) throw new Error(translate(error.message));
  return data as Reaction;
}

export async function removeReaction(id: string): Promise<void> {
  const sb = need();
  const { error } = await sb.from('reactions').delete().eq('id', id);
  if (error) throw new Error(translate(error.message));
}

/**
 * Live-Updates für eine Crew: ruft `onChange` (entprellt) auf, sobald jemand
 * reagiert oder seinen Tag aktualisiert. Gibt eine Abmelde-Funktion zurück.
 */
export function subscribeCrew(crewId: string, isMember: (userId: string) => boolean, onChange: () => void): () => void {
  if (!supabase || !getSession()) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  const soon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 700);
  };
  const channel = supabase
    .channel(`crew-${crewId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter: `crew_id=eq.${crewId}` }, soon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'crew_challenges', filter: `crew_id=eq.${crewId}` }, soon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_status' }, (payload) => {
      const row = (payload.new ?? payload.old) as { user_id?: string } | undefined;
      if (!row?.user_id || isMember(row.user_id)) soon();
    })
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    supabase?.removeChannel(channel);
  };
}

// ---------- Moderation (Migration 0009) ----------

export interface RemovedMember {
  user_id: string;
  display_name: string;
  banned_at: string;
}

/** Nur Besitzer: Mitglied entfernen (kommt mit dem Code nicht wieder rein). */
export async function removeMember(crewId: string, userId: string): Promise<void> {
  const sb = need();
  const { error } = await sb.rpc('remove_member', { p_crew: crewId, p_user: userId });
  if (error) throw new Error(translate(error.message));
}

export async function removedMembers(crewId: string): Promise<RemovedMember[]> {
  const sb = need();
  const { data, error } = await sb.rpc('crew_removed', { p_crew: crewId });
  if (error) throw new Error(translate(error.message));
  return (data ?? []) as RemovedMember[];
}

export async function unbanMember(crewId: string, userId: string): Promise<void> {
  const sb = need();
  const { error } = await sb.rpc('unban_member', { p_crew: crewId, p_user: userId });
  if (error) throw new Error(translate(error.message));
}

/** Nur Besitzer: neuer Einladungscode, der alte gilt nicht mehr. */
export async function renewInviteCode(crewId: string): Promise<string> {
  const sb = need();
  const { data, error } = await sb.rpc('renew_invite_code', { p_crew: crewId });
  if (error) throw new Error(translate(error.message));
  const cached = detailCache.get(crewId);
  if (cached) detailCache.set(crewId, { ...cached, crew: { ...cached.crew, invite_code: data as string } });
  return data as string;
}

// ---------- Anstupsen (Migration 0010) ----------

/** 'sent' oder 'already' (heute schon). */
export async function nudge(crewId: string, userId: string, date: ISODate): Promise<'sent' | 'already'> {
  const sb = need();
  const { data, error } = await sb.rpc('nudge', { p_crew: crewId, p_user: userId, p_date: date });
  if (error) throw new Error(translate(error.message));
  return data as 'sent' | 'already';
}

/** Wen ich heute in dieser Crew schon angestupst habe (leer, wenn die Migration fehlt). */
export async function myNudgesToday(crewId: string): Promise<string[]> {
  if (!supabase || !getSession()) return [];
  const { data, error } = await supabase.rpc('my_nudges_today', { p_crew: crewId });
  if (error) return [];
  return ((data ?? []) as (string | { my_nudges_today: string })[]).map((x) => (typeof x === 'string' ? x : x.my_nudges_today));
}

// ---------- Crew-Arc (Migration 0011) ----------

export async function loadCrewArcs(crewId: string): Promise<{ arcs: CrewArc[]; signatures: CrewArcSignature[] }> {
  if (!supabase || !getSession()) return { arcs: [], signatures: [] };
  const { data, error } = await supabase.from('crew_arcs').select('*').eq('crew_id', crewId).order('start_date');
  if (error) return { arcs: [], signatures: [] }; // Migration 0011 fehlt
  const arcs = (data ?? []) as CrewArc[];
  if (!arcs.length) return { arcs, signatures: [] };
  const { data: sigs } = await supabase
    .from('crew_arc_signatures')
    .select('crew_arc_id, user_id, signed_at')
    .in('crew_arc_id', arcs.map((a) => a.id));
  return { arcs, signatures: (sigs ?? []) as CrewArcSignature[] };
}

/** Nur Besitzer: Crew-Arc veröffentlichen. */
export async function publishCrewArc(input: Omit<CrewArc, 'id' | 'created_by' | 'created_at' | 'updated_at'>): Promise<CrewArc> {
  const sb = need();
  const { data, error } = await sb
    .from('crew_arcs')
    .insert({ ...input, created_by: getSession()!.user.id })
    .select('*')
    .single();
  if (error) throw new Error(translate(error.message));
  return data as CrewArc;
}

export async function deleteCrewArc(id: string): Promise<void> {
  const sb = need();
  const { error } = await sb.from('crew_arcs').delete().eq('id', id);
  if (error) throw new Error(translate(error.message));
}

export async function signCrewArc(id: string): Promise<void> {
  const sb = need();
  const { error } = await sb.from('crew_arc_signatures').upsert({ crew_arc_id: id, user_id: getSession()!.user.id }, { onConflict: 'crew_arc_id,user_id' });
  if (error) throw new Error(translate(error.message));
}

export async function unsignCrewArc(id: string): Promise<void> {
  const sb = need();
  const { error } = await sb.from('crew_arc_signatures').delete().eq('crew_arc_id', id).eq('user_id', getSession()!.user.id);
  if (error) throw new Error(translate(error.message));
}
