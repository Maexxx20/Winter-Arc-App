/**
 * Eingehende Links umleiten, bevor Expo Router sie als Route sucht.
 * Der Rücksprung von Strava (nordwand://localhost/strava?code=…) wird von der Anmeldung
 * selbst verarbeitet; auf Android landet er zusätzlich hier und soll keine Seite öffnen.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (/(^|\/)localhost\/strava/.test(path)) return initial ? '/' : null;
    return path;
  } catch {
    return initial ? '/' : null;
  }
}
