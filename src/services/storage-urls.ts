import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/**
 * Zeitlich begrenzte Links zu Dateien in privaten Buckets, mit Zwischenspeicher.
 * Die Pfade enthalten eine eindeutige Datei-ID, eignen sich also als Cache-Schlüssel für Bilder.
 */
const TTL = 60 * 60 * 24; // 24 h
const cache = new Map<string, { url: string; expires: number }>();
const key = (bucket: string, path: string) => `${bucket}/${path}`;

export function cachedSignedUrl(bucket: string, path: string): string | null {
  const hit = cache.get(key(bucket, path));
  return hit && hit.expires > Date.now() + 60_000 ? hit.url : null;
}

export async function signedUrls(bucket: string, paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of new Set(paths.filter((x): x is string => !!x))) {
    const hit = cachedSignedUrl(bucket, p);
    if (hit) out[p] = hit;
    else missing.push(p);
  }
  if (missing.length && supabase) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(missing, TTL);
    const now = Date.now();
    for (const d of data ?? []) {
      if (!d.signedUrl || !d.path) continue;
      cache.set(key(bucket, d.path), { url: d.signedUrl, expires: now + TTL * 1000 });
      out[d.path] = d.signedUrl;
    }
  }
  return out;
}

/** Link zu einer Datei (oder null, solange er lädt oder es keinen gibt). */
export function useSignedUrl(bucket: string, path: string | null | undefined): string | null {
  const [loaded, setLoaded] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    signedUrls(bucket, [path]).then((m) => {
      if (alive && m[path]) setLoaded({ path, url: m[path] });
    });
    return () => {
      alive = false;
    };
  }, [bucket, path]);
  if (!path) return null;
  // Nie den Link einer anderen Datei liefern (sonst landet er unter dem falschen Cache-Schlüssel).
  if (loaded?.path === path) return loaded.url;
  return cachedSignedUrl(bucket, path);
}
