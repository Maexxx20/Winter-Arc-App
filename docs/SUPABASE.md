# Supabase einrichten

Nordwand läuft ohne Supabase komplett lokal. Mit Supabase kommen Konto (E-Mail-Code, kein Passwort)
und Sync zwischen Geräten dazu.

## 1. Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein neues Projekt erstellen – Name `nordwand`,
   Region **Central EU (Zurich)**.
2. **SQL Editor → New query**: nacheinander den Inhalt dieser Dateien einfügen und **Run**:
   - [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) – Arcs, Einträge, Rückblicke
   - [`supabase/migrations/0002_crews.sql`](../supabase/migrations/0002_crews.sql) – Crews, Tagesstatus, Reaktionen
   - [`supabase/migrations/0003_realtime.sql`](../supabase/migrations/0003_realtime.sql) – Live-Updates in Crews
   - [`supabase/migrations/0004_profiles.sql`](../supabase/migrations/0004_profiles.sql) – Profil (Motto, Instagram, Bild) und Speicher für Profilbilder
   - [`supabase/migrations/0005_challenges.sql`](../supabase/migrations/0005_challenges.sql) – Abzeichen im Profil, Wochen-Challenges
   - [`supabase/migrations/0006_photos.sql`](../supabase/migrations/0006_photos.sql) – Tagebuch-Fotos im Sync (privater Bucket `photos`)
   - [`supabase/migrations/0007_push.sql`](../supabase/migrations/0007_push.sql) – Push bei Reaktionen und Beitritten (schaltet die Erweiterung `pg_net` ein)
   - [`supabase/migrations/0008_strava.sql`](../supabase/migrations/0008_strava.sql) – Strava-Verbindung (Zugangsschlüssel nur für den Server lesbar)

   Alle Dateien lassen sich gefahrlos mehrmals ausführen. Getestet werden sie mit `npm run test:db`
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

## 2b. Eigener Mailversand (Pflicht, sobald andere mittesten)

Der eingebaute Mailversand von Supabase schickt **nur an Mitglieder deines Supabase-Teams** und
höchstens **2 Mails pro Stunde**. Für Freunde in deiner Crew braucht es einen eigenen Anbieter.
Ohne eigene Domain geht das mit **Brevo** (gratis, 300 Mails pro Tag):

1. Konto auf brevo.com erstellen, unter *Senders, Domains & Dedicated IPs → Senders* deine
   E-Mail-Adresse als Absender hinzufügen und bestätigen.
2. Unter *SMTP & API → SMTP* einen SMTP-Schlüssel erzeugen.
3. Supabase → Authentication → Emails → **SMTP Settings** → *Enable Custom SMTP*:
   - Sender email: deine bestätigte Adresse, Sender name: `Nordwand`
   - Host `smtp-relay.brevo.com`, Port `587`
   - Username: dein Brevo-SMTP-Login, Password: der SMTP-Schlüssel
4. Supabase → Authentication → **Rate Limits**: «Rate limit for sending emails» auf z. B. 60 pro Stunde.

**Alternative ohne Brevo: Gmail** (bis ca. 500 Mails pro Tag)

1. Im Google-Konto die Bestätigung in zwei Schritten einschalten.
2. Unter myaccount.google.com/apppasswords ein App-Passwort «Nordwand» erstellen (16 Zeichen).
3. Supabase → SMTP Settings: Host `smtp.gmail.com`, Port `465` (falls es hängt: `587`),
   Username = volle Gmail-Adresse, Password = App-Passwort **ohne Leerzeichen**,
   Sender email = dieselbe Gmail-Adresse.

Meldet die App «Die Mail konnte nicht verschickt werden» (Supabase: *gateway timed out*), erreicht
Supabase den Mailserver nicht oder wird abgewiesen. Den genauen Grund zeigt **Logs → Auth**.

Mit einer Gmail-Absenderadresse landen Mails manchmal im Spam. Sobald du eine Domain hast, dort die
Domain in Brevo verifizieren und als Absender z. B. `code@deinedomain.ch` nehmen.

## 2c. Push-Mitteilungen

1. Migration `0007_push.sql` ausführen (siehe oben). Sie schaltet `pg_net` ein; die Datenbank schickt
   die Mitteilungen dann selbst an den Expo-Push-Dienst.
2. Im Projektordner einmal `npx eas-cli@latest init` ausführen. Das trägt die Projekt-ID in
   `app.json` ein – ohne sie kann die App kein Push-Token holen.
3. In der App: Vertrag → Erinnerungen → «Crew-Mitteilungen» einschalten. In Expo Go geht das nur auf
   dem iPhone; auf Android braucht es einen Development-Build.

## 2d. Strava (optional)

Die Verbindung zu Strava läuft über eine Edge Function, damit das Client-Secret von Strava nie in der
App steckt.

1. **Strava-API-App anlegen:** [strava.com/settings/api](https://www.strava.com/settings/api) →
   Anwendungsname `Nordwand`, Kategorie *Training*, Website z. B. die GitHub-Pages-Adresse,
   **Authorization Callback Domain: `localhost`** (genau so – die App springt über
   `nordwand://localhost/strava` zurück). Danach *Client ID* und *Client Secret* notieren.
2. Migration `0008_strava.sql` ausführen (siehe oben).
3. **Edge Function anlegen:** Supabase → **Edge Functions → Deploy a new function → Via Editor**,
   Name **`strava`**, den ganzen Inhalt von
   [`supabase/functions/strava/index.ts`](../supabase/functions/strava/index.ts) einfügen,
   **Deploy**. «Verify JWT» eingeschaltet lassen.
4. **Secrets:** Edge Functions → **Secrets** → `STRAVA_CLIENT_ID` und `STRAVA_CLIENT_SECRET` mit den
   Werten aus Schritt 1 anlegen. (`SUPABASE_URL` usw. setzt Supabase selbst.)
5. Testen geht erst im Development-Build (Expo Go kann nicht aus dem Browser zurückspringen):
   Vertrag → Verbindungen → «Mit Strava verbinden».

Gut zu wissen:
- Neue Strava-Apps dürfen zuerst nur **ein** Konto verbinden (deins). Für alle Nutzer muss die App
  bei Strava zur Prüfung eingereicht werden (Formular auf der API-Seite). Dafür verlangt Strava den
  offiziellen Knopf «Connect with Strava» und das Logo «Powered by Strava» – das kommt vor dem Release.
- Die Funktion speichert die Aktivitäten 15 Minuten zwischen, damit das Abfrage-Limit von Strava
  (für die ganze App gemeinsam) reicht.
- Später aktualisieren: dieselbe Funktion im Editor öffnen, neuen Inhalt einfügen, **Deploy**.

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
| Profil (Name, Motto, Instagram, Bild) | ✓ – sichtbar nur für Crew-Mitglieder; Bild im privaten Bucket `avatars` |
| Fotos im Tagebuch | ✓ – nur für dich; ein Datensatz pro Foto (`diary_photos`), Datei im Bucket `photos` |
| Abzeichen | ✓ – werden berechnet und für die Crew im Profil veröffentlicht |
| Werte aus Apple Health / Health Connect | nur lokal gelesen; gesichert wird nur das Ergebnis der Regel (Häkchen bzw. Menge) |
| Strava | Zugangsschlüssel und Aktivitäten der letzten 14 Tage in `strava_connections` – nur die Edge Function liest sie |
| Einstellungen, Erinnerungen, Widget | nur lokal (pro Gerät) |
| Crew-Tagesstatus | Status, Anzahl erledigter Regeln, Streak, Quote – sichtbar nur für Crew-Mitglieder |

Konflikte: Die zuletzt geänderte Version gewinnt (pro Tag bzw. pro Arc).
