# Supabase einrichten

Nordwand läuft ohne Supabase komplett lokal. Mit Supabase kommen Konto (E-Mail-Code, kein Passwort)
und Sync zwischen Geräten dazu.

## 1. Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein neues Projekt erstellen – Name `nordwand`,
   Region **Central EU (Zurich)**.
2. **SQL Editor → New query**: nacheinander den Inhalt dieser Dateien einfügen und **Run**:
   - [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) – Arcs, Einträge, Rückblicke
   - [`supabase/migrations/0002_crews.sql`](../supabase/migrations/0002_crews.sql) – Crews, Tagesstatus, Reaktionen

   Beide Dateien lassen sich gefahrlos mehrmals ausführen. Getestet werden sie mit `npm run test:db`
   (eingebettetes Postgres, prüft alle Zugriffsregeln).

## 2. Login per Code aktivieren

Standardmässig schickt Supabase einen Link. Die App braucht einen 6-stelligen Code:

1. **Authentication → Emails → Templates → Magic Link**
2. Betreff z. B. `Dein Nordwand-Code`, Inhalt z. B.:

   ```html
   <h2>Dein Code für Nordwand</h2>
   <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
   <p>Der Code ist eine Stunde gültig.</p>
   ```

3. Gleich vorgehen beim Template **Confirm signup** (wird beim allerersten Login verschickt).

> Der eingebaute Mailversand von Supabase ist auf wenige Mails pro Stunde begrenzt. Für den
> Store-Release einen eigenen SMTP-Anbieter eintragen (Authentication → Emails → SMTP Settings),
> z. B. Resend oder Brevo.

## 3. Schlüssel in die App

Unter **Project Settings → API** die *Project URL* und den *anon / publishable key* kopieren und im
Projektordner eine Datei `.env.local` anlegen (wird nicht ins Git hochgeladen):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Danach `npx expo start --clear`. Im Tab **Vertrag** erscheint jetzt «Konto & Sync».

## Was synchronisiert wird

| Daten | Sync |
|---|---|
| Arcs, Regeln, Vertrag | ✓ |
| Häkchen und Mengen pro Tag | ✓ |
| Notizen | ✓ |
| Wochenrückblicke | ✓ |
| Fotos | nur lokal (kommt später über Supabase Storage) |
| Einstellungen, Erinnerungen | nur lokal (pro Gerät) |
| Crew-Tagesstatus | Status, Anzahl erledigter Regeln, Streak, Quote – sichtbar nur für Crew-Mitglieder |

Konflikte: Die zuletzt geänderte Version gewinnt (pro Tag bzw. pro Arc).
