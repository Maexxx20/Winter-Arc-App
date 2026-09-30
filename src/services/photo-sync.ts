import { isSyncablePhoto, type PhotoRow, photoRowsToPush } from '@/lib/photo-merge';
import { applyRemotePhotos, getState, markPhotoUploaded, setSyncMeta } from '@/store/store';

import { photoBytes, photoExists, photoUri } from './photos';
import { useSignedUrl } from './storage-urls';
import { getSession, supabase } from './supabase';

export const PHOTO_BUCKET = 'photos';
const TABLE = 'diary_photos';

/** Pfad im Bucket: "<user-id>/<datei>.jpg" */
export function remotePhotoPath(userId: string, name: string): string {
  return `${userId}/${name.split('/').pop()}`;
}

/** Dateien, deren Upload in dieser Sitzung schon gescheitert ist – erst beim nächsten Start wieder versuchen. */
const failedThisSession = new Set<string>();

/**
 * Fotos abgleichen: neue Dateien hochladen, Datensätze (inkl. Löschmarken) hochladen,
 * gelöschte Dateien im Konto entfernen, dann Änderungen anderer Geräte holen.
 */
export async function syncPhotos(userId: string): Promise<void> {
  if (!supabase) return;
  const sb = supabase;

  // 1) Hochladen
  const pushStart = new Date().toISOString();
  const meta = getState().sync;
  const rows = photoRowsToPush(getState().photoLog ?? {}, meta?.photosPushedAt ?? null);
  let complete = true;
  const ready: PhotoRow[] = [];

  for (const row of rows) {
    // Aktuellen Stand nehmen – das Foto könnte inzwischen gelöscht worden sein.
    const rec = getState().photoLog?.[row.name];
    if (!rec) continue;
    const current: PhotoRow = { ...row, deleted: rec.deleted, updated_at: new Date(rec.updatedAt).toISOString() };

    if (current.deleted) {
      const { error } = await sb.storage.from(PHOTO_BUCKET).remove([remotePhotoPath(userId, current.name)]);
      if (error) complete = false; // Datensatz trotzdem senden, Datei beim nächsten Mal nochmal löschen
    } else if (photoExists(current.name) && !getState().sync?.uploadedPhotos?.includes(current.name)) {
      if (failedThisSession.has(current.name)) {
        complete = false;
        continue;
      }
      try {
        const { error } = await sb.storage
          .from(PHOTO_BUCKET)
          .upload(remotePhotoPath(userId, current.name), await photoBytes(current.name), { contentType: 'image/jpeg', upsert: true });
        if (error) throw new Error(error.message);
        markPhotoUploaded(current.name);
      } catch (e) {
        console.warn('Foto-Upload fehlgeschlagen', current.name, e);
        failedThisSession.add(current.name);
        complete = false;
        continue; // Datensatz erst senden, wenn die Datei im Konto liegt
      }
    }
    ready.push(current);
  }

  for (let i = 0; i < ready.length; i += 200) {
    const { error } = await sb.from(TABLE).upsert(ready.slice(i, i + 200), { onConflict: 'user_id,name' });
    if (error && missingTable(error.message)) return; // Migration 0006 fehlt: Fotos bleiben vorerst lokal
    if (error) throw new Error(`Fotos: ${error.message}`);
  }
  if (complete) setSyncMeta({ photosPushedAt: pushStart });

  // 2) Herunterladen
  const since = getState().sync?.photosPulledAt ?? null;
  const pulled: PhotoRow[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(TABLE).select('name, arc_id, date, deleted, updated_at, server_updated_at').order('server_updated_at').range(from, from + 999);
    if (since) q = q.gt('server_updated_at', since);
    const { data, error } = await q;
    if (error && missingTable(error.message)) return;
    if (error) throw new Error(`Fotos: ${error.message}`);
    pulled.push(...((data ?? []) as PhotoRow[]));
    if (!data || data.length < 1000) break;
  }
  if (pulled.length) {
    // Was vom Server kommt, liegt dort schon als Datei.
    for (const r of pulled) if (!r.deleted) markPhotoUploaded(r.name);
    applyRemotePhotos(pulled);
    setSyncMeta({ photosPulledAt: pulled[pulled.length - 1].server_updated_at ?? null });
  }
}

function missingTable(message: string): boolean {
  return /diary_photos|schema cache|does not exist/i.test(message);
}

/** Alle Fotos des Kontos löschen (Konto löschen, alle Daten löschen). Wirft bei Fehlern. */
export async function removeAllPhotos(userId: string): Promise<void> {
  if (!supabase) return;
  for (let round = 0; round < 100; round++) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(userId, { limit: 100 });
    if (error) {
      // Bucket gibt es noch nicht (Migration 0006 fehlt) → nichts zu löschen.
      if (/not found/i.test(error.message)) return;
      throw new Error(`Fotos konnten nicht gelöscht werden: ${error.message}`);
    }
    if (!data?.length) return;
    const { error: rmError } = await supabase.storage.from(PHOTO_BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
    if (rmError) throw new Error(`Fotos konnten nicht gelöscht werden: ${rmError.message}`);
  }
}

/**
 * Bildquelle für ein Tagebuch-Foto: die Datei auf dem Gerät, sonst (z. B. auf einem
 * neuen Handy) ein Link zum Foto im Konto.
 */
export function usePhotoUri(name: string): string | null {
  const local = photoExists(name);
  const userId = getSession()?.user.id;
  const remote = useSignedUrl(PHOTO_BUCKET, !local && userId && isSyncablePhoto(name) ? remotePhotoPath(userId, name) : null);
  return local ? photoUri(name) : remote;
}
