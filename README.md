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

## Aufbau

```
src/
  app/                  Screens (Expo Router, dateibasiert)
    (tabs)/index.tsx    Heute – Check-in, Bogen-Anzeige, Streak, Schild
    (tabs)/verlauf.tsx  Heatmap über den ganzen Arc, Quote je Regel
    (tabs)/vertrag.tsx  Vertrag, Regeln ändern (Amendments), Einstellungen
    onboarding/         Willkommen + 4-Schritte-Assistent (Zeitraum, Regeln, Warum, Vertrag)
    tag/[date].tsx      Tagesdetail, Nachtragen (bis 2 Tage zurück), Notiz, Fotos
    rueckblick.tsx      Wochenrückblick
    teilen.tsx          Fortschritts-Karte als Bild teilen
    konto.tsx           Anmeldung per E-Mail-Code, Sync-Status, Konto löschen
    (tabs)/crew.tsx     Crews: Liste, erstellen, beitreten
    crew/[id].tsx       Rangliste, Wochenpunkte, Reaktionen, Einladen
    crew/beitreten.tsx  Einstieg über Einladungslink
  components/           UI-Bausteine (ArcGauge, RuleRow, Heatmap, HoldToSign, …)
  lib/arc.ts            Kernlogik – reine Funktionen, getestet in lib/__tests__
  lib/date.ts           Datumsrechnung mit lokalen Kalendertagen (DST-sicher)
  lib/reminders.ts      Planung der Erinnerungen (reine Funktion, getestet)
  lib/sync-merge.ts     Abgleich-Logik: neuere Version gewinnt (getestet)
  lib/crew.ts           Tagesstatus für die Crew und Rangliste (getestet)
  services/             Erinnerungen, Fotos, Supabase, Sync
  store/store.ts        Lokaler Zustand, gespeichert in AsyncStorage (offline-first)
supabase/migrations/    Datenbankschema mit Row Level Security
```

## Regeln der App

- **Tag gehalten** = alle täglichen Regeln erfüllt. Wöchentliche Regeln (z. B. Training 4×) zählen separat.
- **Schild**: Pro Woche (Mo–So) wird ein einzelner verpasster Tag automatisch gerettet.
  Zwei verpasste Tage in Folge beenden den Streak. Grundlage: Lally et al. (2010) – ein einzelner
  verpasster Tag beeinflusst die Gewohnheitsbildung kaum.
- **Vertrag**: Vor dem Start frei änderbar, danach 3 Änderungen. Änderungen gelten ab heute,
  vergangene Tage bleiben so, wie sie bewertet wurden.
- **Nachtragen**: heute und die 2 Tage davor. Ältere Tage sind gesperrt.

## Roadmap

- [x] **Phase 0** – Arc erstellen, Vertrag, Check-in, Streak mit Schild, Heatmap, Tagesnotiz, hell/dunkel
- [x] **Phase 1** – Erinnerungen, Fotos im Journal, Wochenrückblick, teilbare Fortschritts-Karte, Konto + Sync (Supabase)
- [x] **Phase 2** – Crews: Einladung per Code, Tagesstatus der anderen, Reaktionen, Rangliste
- [ ] **Phase 3** – Release: App-Icon, Name, Datenschutzerklärung, Sign in with Apple, Account löschen, TestFlight, Store-Einträge
- [ ] Danach – Widgets, Apple Health, weitere Arcs (Spring Arc …)
