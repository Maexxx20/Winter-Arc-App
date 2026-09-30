import { allBadges } from '@/lib/badges';
import type { ProfileBadge } from '@/lib/crew';
import { todayISO } from '@/lib/date';
import { applyRemoteProfile, getState, type RemoteProfile, setAvatarRemote, touchProfile } from '@/store/store';

import { avatarBytes } from './avatar-file';
import { signedUrls, useSignedUrl } from './storage-urls';
import { supabase } from './supabase';

const BUCKET = 'avatars';

export interface PublicProfile {
  id: string;
  name: string;
  motto: string;
  instagram: string;
  avatar_path: string | null;
  badges?: ProfileBadge[];
}

// ---------- Eigenes Profil abgleichen ----------

/**
 * Neuere Version gewinnt (wie bei Arcs): Ist das Profil auf dem Server neuer,
 * wird es übernommen, sonst wird das lokale hochgeladen – samt neuem Bild.
 */
export async function syncProfile(userId: string): Promise<void> {
  if (!supabase) return;
  const { data: row, error } = await supabase
    .from('profiles')
    .select('name, motto, instagram, avatar_path, updated_at, badges')
    .eq('id', userId)
    .maybeSingle<RemoteProfile & { badges: ProfileBadge[] | null }>();
  if (error) throw new Error(`profiles: ${error.message}`);

  await syncProfileFields(userId, row);
  // Abzeichen danach, damit die Profilzeile sicher existiert.
  await publishBadges(userId, row?.badges ?? null);
}

/** Verdiente Abzeichen für die Crew veröffentlichen (nur wenn sich etwas geändert hat). */
async function publishBadges(userId: string, server: ProfileBadge[] | null) {
  const s = getState();
  const today = todayISO(new Date(), s.settings.rolloverHour);
  const seen = new Set<string>();
  const list: ProfileBadge[] = [];
  for (const b of allBadges(s.arcs, s.logs, s.reviews, today).sort((a, z) => a.date.localeCompare(z.date))) {
    const key = `${b.id}|${b.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ id: b.id, date: b.date });
  }
  const next = list.slice(-200);
  if (JSON.stringify(next) === JSON.stringify(server ?? [])) return;
  // updated_at bleibt gleich: Abzeichen sind berechnet und gewinnen nie gegen Profiländerungen.
  const { error } = await supabase!.from('profiles').update({ badges: next }).eq('id', userId);
  if (error) throw new Error(`Abzeichen: ${error.message}`);
}

async function syncProfileFields(userId: string, row: RemoteProfile | null) {
  const local = getState().settings;
  if (!local.profileUpdatedAt) {
    // Noch nie bearbeitet: Server hat Vorrang (z. B. neues Gerät), sonst einmal hochladen.
    if (row) return applyRemoteProfile(row);
    if (!local.name) return;
    touchProfile();
  } else if (row && new Date(row.updated_at) >= new Date(local.profileUpdatedAt)) {
    if (new Date(row.updated_at) > new Date(local.profileUpdatedAt)) applyRemoteProfile(row);
    return;
  }

  await pushProfile(userId, row?.avatar_path ?? null);
}

async function pushProfile(userId: string, serverAvatar: string | null) {
  const sb = supabase!;
  let s = getState().settings;

  // Neues Bild zuerst hochladen – jedes Mal unter neuem Namen, damit keine alte Version im Cache hängt.
  if (s.avatar.local && !s.avatar.remote) {
    const local = s.avatar.local;
    const path = `${userId}/${Date.now()}.jpg`;
    const body = await avatarBytes(local);
    const { error } = await sb.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error(`Profilbild: ${error.message}`);
    if (!setAvatarRemote(local, path)) {
      // Während des Uploads wurde ein anderes Bild gewählt oder das Bild entfernt.
      await sb.storage.from(BUCKET).remove([path]);
      return; // der nächste Abgleich lädt den neuen Stand hoch
    }
    s = getState().settings;
  }

  const { data: saved, error } = await sb
    .from('profiles')
    .upsert(
      {
        id: userId,
        name: s.name.trim().slice(0, 40),
        motto: s.motto.trim().slice(0, 80),
        instagram: s.instagram,
        avatar_path: s.avatar.remote,
        updated_at: s.profileUpdatedAt ?? new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('name, motto, instagram, avatar_path, updated_at')
    .single<RemoteProfile>();
  if (error) throw new Error(`profiles: ${error.message}`);

  // Ein anderes Gerät war schneller (die Datenbank behält die neuere Version): übernehmen.
  if (saved.avatar_path !== s.avatar.remote || new Date(saved.updated_at) > new Date(s.profileUpdatedAt ?? 0)) {
    applyRemoteProfile(saved);
    return;
  }

  // Das bisherige Bild auf dem Server ist ersetzt oder entfernt → löschen.
  if (serverAvatar && serverAvatar !== saved.avatar_path) {
    await sb.storage.from(BUCKET).remove([serverAvatar]);
  }
}

/** Löscht alle Profilbilder des Kontos ausser `keep`. */
export async function removeAvatars(userId: string, keep: string | null = null): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 });
  const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
}

// ---------- Profile anderer (Crew) ----------

export async function fetchProfiles(ids: string[]): Promise<Record<string, PublicProfile>> {
  if (!supabase || !ids.length) return {};
  const { data, error } = await supabase.from('profiles').select('id, name, motto, instagram, avatar_path, badges').in('id', ids);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((p) => [p.id, p as PublicProfile]));
}

// ---------- Bild-Links (privater Bucket → zeitlich begrenzte Links) ----------

export function avatarUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  return signedUrls(BUCKET, paths);
}

/** Link zu einem Profilbild auf dem Server (oder null, solange er lädt). */
export function useAvatarUrl(path: string | null | undefined): string | null {
  return useSignedUrl(BUCKET, path);
}
