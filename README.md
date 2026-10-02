# Nordwand – Winter Arc Tracker

Tracker für den Winter Arc: eigene Regeln festlegen, einen Vertrag mit sich selbst unterschreiben und
92 Tage lang (1. Oktober – 31. Dezember) jeden Tag abhaken. Expo (React Native + TypeScript),
offline-first mit optionalem Sync über Supabase. Ziel: App Store und Google Play.

> App-Name: **Nordwand** (Store-Untertitel: «Winter Arc Tracker»). Bundle-ID `ch.maxkon.nordwand`.

## Loslegen

```bash
npm install
npx expo start
```

Dann auf dem iPhone die App **Expo Go** aus dem App Store laden und den QR-Code aus dem Terminal
mit der Kamera scannen. Laptop und iPhone müssen im selben WLAN sein (sonst `npx expo start --tunnel`).

Weitere Befehle:

| Befehl | Zweck |
|---|---|
| `npm test` | Unit-Tests der Arc-Logik (Streak, Schild, Statistik) |
| `npm run typecheck` | TypeScript prüfen |
| `npm run test:db` | Datenbankschema und Zugriffsregeln gegen eingebettetes Postgres testen |
| `npm run web` | Vorschau im Browser |

Konto & Sync einrichten: siehe [docs/SUPABASE.md](docs/SUPABASE.md). Ohne `.env.local` läuft die App rein lokal.

### Expo Go oder Development-Build?

`npm start` startet für **Expo Go** – damit läuft fast alles. Apple Health, Health Connect, Strava,
die Widgets (iOS und Android) und die Schnellaktionen brauchen native Teile, die Expo Go nicht hat; dort zeigt die App einen Hinweis statt
abzustürzen. Zum Testen: einmal `npx eas-cli@latest build --profile development --platform ios`
(braucht das Apple-Developer-Konto), die App aufs iPhone laden und dann `npm run start:dev`.

## Aufbau

```
index.ts                Einstiegspunkt: Expo Router + (nur Android) Hintergrund-Aufgabe fürs Homescreen-Widget
locales/                Übersetzte Systemtexte (Berechtigungen, App-Name) für iOS: de, en, fr, it
src/
  app/                  Screens (Expo Router, dateibasiert)
    (tabs)/index.tsx    Heute – Check-in, Bogen-Anzeige, Streak, Schild
    (tabs)/verlauf.tsx  Heatmap über den ganzen Arc, Quote je Regel
    (tabs)/vertrag.tsx  Vertrag, Regeln ändern (Amendments), Einstellungen
    onboarding/         Willkommen + 4-Schritte-Assistent (Zeitraum, Regeln, Warum, Vertrag)
    tag/[date].tsx      Tagesdetail: heute bearbeiten, frühere Tage nur ansehen
    rueckblick.tsx      Wochenrückblick
    arc-rueckblick.tsx  Arc-Rückblick: der Arc in Zahlen (auch als Zwischenstand)
    fortschritt/        Vorher/Nachher aus Tagebuch-Fotos (Schieberegler, als Bild teilen)
    teilen.tsx          Fortschritts-Karte als Bild teilen
    konto.tsx           Anmeldung per E-Mail-Code, Sync-Status, Konto löschen
    profil.tsx          Eigenes Profil: Bild, Name, Motto, Instagram, Statistik, Abmelden
    (tabs)/crew.tsx     Crews: Liste, erstellen, beitreten
    crew/[id].tsx       Rangliste, Wochenpunkte, Reaktionen, Einladen
    crew/beitreten.tsx  Einstieg über Einladungslink
    crew/mitglied.tsx   Profil eines Crew-Mitglieds, Blockieren, Melden, Entfernen
    crew/challenge.tsx  Wochen-Challenge starten/ändern
    crew/arc.tsx        Crew-Arc: Vorlage erstellen, übernehmen und unterschreiben, Regel-Vergleich
    regel/[id].tsx      Statistik einer Regel (Quote, Serie, Wochen, Wochentage)
    arcs.tsx, arc/[id]  Archiv früherer Arcs
    +native-intent.tsx  Rücksprung von Strava abfangen
  components/           UI-Bausteine (ArcGauge, RuleRow, Heatmap, HoldToSign, …)
  lib/arc.ts            Kernlogik – reine Funktionen, getestet in lib/__tests__
  lib/date.ts           Datumsrechnung mit lokalen Kalendertagen (DST-sicher)
  lib/reminders.ts      Planung der Erinnerungen (reine Funktion, getestet)
  lib/sync-merge.ts     Abgleich-Logik: neuere Version gewinnt (getestet)
  lib/crew.ts           Tagesstatus, Rangliste, Challenges, Feed (getestet)
  lib/badges.ts         Abzeichen – aus den Daten berechnet (getestet)
  lib/photo-merge.ts    Foto-Abgleich mit Löschmarken (getestet)
  lib/rule-stats.ts     Statistik pro Regel (getestet)
  lib/seasons.ts        Saison-Arcs (New Year, Spring, Summer, Winter) und eigene Arcs (getestet)
  lib/health.ts         Welche Messung hakt welche Regel ab, Zeitfenster (getestet)
  lib/widget-data.ts    Daten fürs Widget, Taps aus dem Widget (getestet)
  lib/crew-arc.ts       Crew-Arc als Vorlage, Regel-für-Regel-Vergleich (getestet)
  lib/recap.ts          Zahlen für den Arc-Rückblick (getestet)
  lib/export.ts         Datenexport als JSON bzw. CSV (getestet)
  i18n/                 Übersetzungen: t()/tl(), Wörterbücher pro Sprache in i18n/locales/{de,en,fr,it}
  services/             Erinnerungen, Fotos, Supabase, Sync, Health, Strava, Widget, Push, Blockieren,
                        Sprache, Schnellaktionen, Datenexport (Teilen-Menü)
  widgets/              iOS-Widget (expo-widgets, SwiftUI-Komponenten)
  widgets/android/      Android-Widget (react-native-android-widget) und seine Hintergrund-Aufgabe
  store/store.ts        Lokaler Zustand, gespeichert in AsyncStorage (offline-first)
supabase/migrations/    Datenbankschema mit Row Level Security (0001–0011)
supabase/functions/     Edge Function «strava» (OAuth und Aktivitäten, Secret bleibt auf dem Server)
supabase/tests/         Zugriffsregeln gegen eingebettetes Postgres (npm run test:db)
docs/                   Website mit Datenschutzerklärung auf de/en/fr/it (GitHub Pages; en/, fr/, it/),
                        Store-Texte in vier Sprachen, Supabase- und EAS-Update-Anleitung
assets/brand/           Icon-Vorlage; node assets/brand/make-icons.mjs erzeugt alle Icons neu
```

## Regeln der App

- **Tag gehalten** = alle täglichen Regeln erfüllt. Wöchentliche Regeln (z. B. Training 4×) zählen separat.
- **Schild**: Pro Woche (Mo–So) wird ein einzelner verpasster Tag automatisch gerettet.
  Zwei verpasste Tage in Folge beenden den Streak. Grundlage: Lally et al. (2010) – ein einzelner
  verpasster Tag beeinflusst die Gewohnheitsbildung kaum.
- **Vertrag**: Vor dem Start frei änderbar, danach 3 Änderungen. Änderungen gelten ab heute,
  vergangene Tage bleiben so, wie sie bewertet wurden.
- **Kein Nachtragen**: Abgehakt wird nur heute (mit «Tag endet um …» zählt die Nacht noch zum Vortag). Verpasst bleibt verpasst; nur Apple Health und Strava dürfen gestern noch automatisch ergänzen.

## Roadmap

- [x] **Phase 0** – Arc erstellen, Vertrag, Check-in, Streak mit Schild, Heatmap, Tagesnotiz, hell/dunkel
- [x] **Phase 1** – Erinnerungen, Fotos im Journal, Wochenrückblick, teilbare Fortschritts-Karte, Konto + Sync (Supabase)
- [x] **Phase 2** – Crews: Einladung per Code, Tagesstatus der anderen, Reaktionen, Rangliste
- [x] **Phase 3 (Code)** – App-Icon, Live-Updates in Crews, EAS-Build-Profile, Datenschutzerklärung und Website (`docs/`), Store-Texte (`docs/APP_STORE.md`), Review-Zugang
- [ ] **Phase 3 (Release)** – Apple-Developer-Konto, Builds, TestFlight, Store-Einträge (siehe Checkliste)
- [x] **Ausbau 1** – Profil, Abzeichen, Wochen-Challenges und Feed in Crews, Fotos im Sync, Push bei Reaktionen
- [x] **Ausbau 2 (Code)** – Statistik pro Regel, Saison-Arcs und eigene Arcs mit Archiv, Apple Health / Health Connect / Strava (automatisch abhaken), Widgets für Home- und Sperrbildschirm
- [ ] **Ausbau 2 (Test)** – Health, Strava und Widgets im Development-Build prüfen (braucht Apple-Developer-Konto)
- [x] **Ausbau 3 (Code)** – Moderation (Blockieren, Mitglieder entfernen, Code erneuern), Anstupsen, Crew-Arc als
  Vorlage, Vorher/Nachher, Arc-Rückblick, Erinnerung pro Regel, Schnellaktionen, Datenexport (CSV/JSON),
  Android-Widget, 4 Sprachen (de/en/fr/it, auch Mitteilungen und Website), EAS Update
- [ ] **Ausbau 3 (Test)** – Migrationen 0009–0011 auf Supabase ausführen, Android-Widget und Schnellaktionen im
  Development-Build prüfen, erstes EAS Update auf `preview`, Login-Mail mehrsprachig (siehe docs/SUPABASE.md)
