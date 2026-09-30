/** Profil-Hilfen ohne Netzwerk (getestet). */

/** Eingabe säubern: @ und Links entfernen, nur erlaubte Zeichen. */
export function cleanInstagram(input: string): string {
  let v = input.trim();
  const m = v.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) v = m[1];
  return v.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30);
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}
