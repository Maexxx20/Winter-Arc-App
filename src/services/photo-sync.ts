import { isSyncablePhoto } from '@/lib/sync-merge';
import { getState, markPhotosSynced } from '@/store/store';

import { photoBytes, photoExists, photoUri as photoUriOf } from './photos';
import { useSignedUrl } from './storage-urls';
import { getSession, supabase } from './supabase';

export const PHOTO_BUCKET = 'photos';

/** Pfad im Bucket: "<user-id>/<datei>.jpg" */
export function remotePhotoPath(userId: string, name: string): string {
  return `${userId}/${name.split('/').pop()}`;
}

/**
 * Lädt Fotos hoch, die noch nicht im Konto liegen.
 * Gibt die Einträge ("arcId|datum") zurück, deren Fotoliste deshalb neu hochgeladen werden muss.
 */
export async function uploadPendingPhotos(userId: string): Promise<Set<string>> {
  const affected = new Set<string>();
  if (!supabase) return affected;
  const s = getState();
  const done = new Set(s.sync?.uploadedPhotos ?? []);
  const uploaded: string[] = [];

  for (const [arcId, log] of Object.entries(s.logs)) {
    for (const [date, entry] of Object.entries(log)) {
      for (const name of entry.photos ?? []) {
        if (!isSyncablePhoto(name) || done.has(name) || !photoExists(name)) continue;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(remotePhotoPath(userId, name), await photoBytes(name), { contentType: 'image/jpeg', upsert: true });
        if (error) {
          console.warn('Foto-Upload fehlgeschlagen', name, error.message);
          continue; // nächster Abgleich versucht es wieder
        }
        uploaded.push(name);
        done.add(name);
        affected.add(`${arcId}|${date}`);
      }
    }
  }
  if (uploaded.length) markPhotosSynced(uploaded, []);
  return affected;
}

/** Lokal gelöschte Fotos auch im Konto löschen. */
export async function deleteRemovedPhotos(userId: string): Promise<void> {
  const pending = getState().sync?.photoDeletes ?? [];
  if (!supabase || !pending.length) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(pending.map((n) => remotePhotoPath(userId, n)));
  if (!error) markPhotosSynced([], pending);
}

/** Alle Fotos des Kontos löschen (Konto löschen, alle Daten löschen). */
export async function removeAllPhotos(userId: string): Promise<void> {
  if (!supabase) return;
  for (let round = 0; round < 50; round++) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(userId, { limit: 100 });
    if (error || !data?.length) return;
    const { error: rmError } = await supabase.storage.from(PHOTO_BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
    if (rmError) return;
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
  if (local) return photoUriOf(name);
  return remote;
}

