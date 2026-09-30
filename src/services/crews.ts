import { buildStatusRows, type Crew, type CrewMember, normalizeCode, type Reaction, type ReactionEmoji, type StatusRow } from '@/lib/crew';
import { addDays, type ISODate, todayISO } from '@/lib/date';
import { getState, selectActiveArc, selectLog } from '@/store/store';

import { getSession, supabase } from './supabase';

export type CrewWithCount = Crew & { member_count: number };

export interface CrewDetail {
  crew: Crew;
  members: CrewMember[];
  rows: StatusRow[];
  reactions: Reaction[];
}

function translate(message: string): string {
  if (message.includes('crew_not_found')) return 'Diesen Code gibt es nicht. Prüf ihn nochmal.';
  if (message.includes('crew_full')) return 'Diese Crew ist voll (max. 20 Personen).';
  if (message.includes('too_many_crews')) return 'Du bist schon in 5 Crews – mehr geht nicht.';
  if (message.includes('not_authenticated')) return 'Bitte melde dich zuerst an.';
  if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) return 'Keine Verbindung. Bist du online?';
  return message;
}

function need() {
  if (!supabase || !getSession()) throw new Error('Bitte melde dich zuerst an.');
  return supabase;
}

function displayName(): string {
  return getState().settings.name.trim() || 'Ohne Namen';
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
  const { error } = await supabase.from('daily_status').upsert(rows, { onConflict: 'user_id,date' });
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
  const since = addDays(today, -6);
  const [crewRes, membersRes, reactionsRes] = await Promise.all([
    sb.from('crews').select('id, name, invite_code, created_by').eq('id', crewId).single(),
    sb.from('crew_members').select('*').eq('crew_id', crewId).order('joined_at'),
    sb.from('reactions').select('id, crew_id, from_user, to_user, date, emoji').eq('crew_id', crewId).gte('date', since),
  ]);
  if (crewRes.error) throw new Error(translate(crewRes.error.message));
  if (membersRes.error) throw new Error(translate(membersRes.error.message));
  if (reactionsRes.error) throw new Error(translate(reactionsRes.error.message));
  const members = (membersRes.data ?? []) as CrewMember[];

  const { data: rows, error } = await sb
    .from('daily_status')
    .select('*')
    .in('user_id', members.map((m) => m.user_id))
    .gte('date', since);
  if (error) throw new Error(translate(error.message));

  return {
    crew: crewRes.data as Crew,
    members,
    rows: (rows ?? []) as StatusRow[],
    reactions: (reactionsRes.data ?? []) as Reaction[],
  };
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
