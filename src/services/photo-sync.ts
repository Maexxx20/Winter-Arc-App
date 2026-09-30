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
  const skipped = new Set(meta?.skippedPhotos ?? []);
  /** Ältester Datensatz, der noch nicht fertig ist – dort setzt der nächste Abgleich wieder an. */
  let retryFrom: string | null = null;
  const retry = (updatedAt: string) => {
    const before = new Date(new Date(updatedAt).getTime() - 1).toISOString();
    if (!retryFrom || before < retryFrom) retryFrom = before;
  };
  const ready: PhotoRow[] = [];

  for (const row of rows) {
    // Aktuellen Stand nehmen – das Foto könnte inzwischen gelöscht worden sein.
    const rec = getState().photoLog?.[row.name];
    if (!rec) continue;
    const current: PhotoRow = { ...row, deleted: rec.deleted, updated_at: new Date(rec.updatedAt).toISOString() };

    if (!current.deleted) {
      const uploaded = () => !!getState().sync?.uploadedPhotos?.includes(current.name);
      if (!uploaded() && photoExists(current.name) && !skipped.has(current.name)) {
        if (failedThisSession.has(current.name)) {
          retry(current.updated_at);
          continue;
        }
        try {
          const { error } = await sb.storage
            .from(PHOTO_BUCKET)
            .upload(remotePhotoPath(userId, current.name), await photoBytes(current.name), { contentType: 'image/jpeg', upsert: true });
          if (error) throw new Error(error.message);
          markPhotoUploaded(current.name);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('Foto-Upload fehlgeschlagen', current.name, msg);
          if (/size|large|413|mime|type/i.test(msg)) {
            // Dauerhaft (zu gross, falsches Format): nicht endlos wiederholen.
            skipped.add(current.name);
            setSyncMeta({ skippedPhotos: [...skipped] });
          } else {
            failedThisSession.add(current.name);
            retry(current.updated_at);
          }
          continue;
        }
      }
      // Nur Fotos melden, deren Datei wirklich im Konto liegt – sonst sehen andere Geräte ein leeres Bild.
      if (!uploaded()) continue;
    }
    ready.push(current);
  }

  for (let i = 0; i < ready.length; i += 200) {
    const { data: saved, error } = await sb
      .from(TABLE)
      .upsert(ready.slice(i, i + 200), { onConflict: 'user_id,name' })
      .select('name, deleted');
    if (error && missingTable(error.message)) return; // Migration 0006 fehlt: Fotos bleiben vorerst lokal
    if (error) throw new Error(`Fotos: ${error.message}`);
    // Datei erst löschen, wenn der Server die Löschmarke angenommen hat (sonst gewinnt eine neuere Version).
    const gone = (saved ?? []).filter((r) => r.deleted).map((r) => remotePhotoPath(userId, r.name));
    if (gone.length) {
      const { error: rmError } = await sb.storage.from(PHOTO_BUCKET).remove(gone);
      if (rmError) {
        for (const r of ready.slice(i, i + 200)) if (r.deleted) retry(r.updated_at);
      }
    }
  }
  setSyncMeta({ photosPushedAt: retryFrom ?? pushStart });

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
