import { useEffect, useState } from 'react';

import { applyRemoteProfile, getState, type RemoteProfile, setAvatarRemote, touchProfile } from '@/store/store';

import { avatarBytes } from './avatar-file';
import { supabase } from './supabase';

const BUCKET = 'avatars';

export interface PublicProfile {
  id: string;
  name: string;
  motto: string;
  instagram: string;
  avatar_path: string | null;
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
    .select('name, motto, instagram, avatar_path, updated_at')
    .eq('id', userId)
    .maybeSingle<RemoteProfile>();
  if (error) throw new Error(`profiles: ${error.message}`);

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
  const { data, error } = await supabase.from('profiles').select('id, name, motto, instagram, avatar_path').in('id', ids);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((p) => [p.id, p as PublicProfile]));
}

// ---------- Bild-Links (privater Bucket → zeitlich begrenzte Links) ----------

const TTL = 60 * 60 * 24; // 24 h
const urlCache = new Map<string, { url: string; expires: number }>();

export async function avatarUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  const now = Date.now();
  for (const p of new Set(paths.filter((x): x is string => !!x))) {
    const hit = urlCache.get(p);
    if (hit && hit.expires > now + 60_000) out[p] = hit.url;
    else missing.push(p);
  }
  if (missing.length && supabase) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, TTL);
    for (const d of data ?? []) {
      if (!d.signedUrl || !d.path) continue;
      urlCache.set(d.path, { url: d.signedUrl, expires: now + TTL * 1000 });
      out[d.path] = d.signedUrl;
    }
  }
  return out;
}

/** Link zu einem Profilbild auf dem Server (oder null, solange er lädt). */
export function useAvatarUrl(path: string | null | undefined): string | null {
  const [loaded, setLoaded] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    avatarUrls([path]).then((m) => {
      if (alive && m[path]) setLoaded({ path, url: m[path] });
    });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path) return null;
  // Nie den Link eines alten Bildes für einen neuen Pfad liefern (sonst landet er unter dem falschen Cache-Schlüssel).
  if (loaded?.path === path) return loaded.url;
  return urlCache.get(path)?.url ?? null;
}
