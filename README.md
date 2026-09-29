# Winter Arc App

Tracker für den Winter Arc: eigene Regeln festlegen, einen Vertrag mit sich selbst unterschreiben und
92 Tage lang (1. Oktober – 31. Dezember) jeden Tag abhaken. Expo (React Native + TypeScript), später
mit Supabase. Ziel: App Store und Google Play.

> Arbeitstitel. Der finale Name kommt vor dem Store-Release.

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
| `npm run web` | Vorschau im Browser |

## Aufbau

```
src/
  app/                  Screens (Expo Router, dateibasiert)
    (tabs)/index.tsx    Heute – Check-in, Bogen-Anzeige, Streak, Schild
    (tabs)/verlauf.tsx  Heatmap über den ganzen Arc, Quote je Regel
    (tabs)/vertrag.tsx  Vertrag, Regeln ändern (Amendments), Einstellungen
    onboarding/         Willkommen + 4-Schritte-Assistent (Zeitraum, Regeln, Warum, Vertrag)
    tag/[date].tsx      Tagesdetail, Nachtragen (bis 2 Tage zurück), Notiz
  components/           UI-Bausteine (ArcGauge, RuleRow, Heatmap, HoldToSign, …)
  lib/arc.ts            Kernlogik – reine Funktionen, getestet in lib/__tests__
  lib/date.ts           Datumsrechnung mit lokalen Kalendertagen (DST-sicher)
  store/store.ts        Lokaler Zustand, gespeichert in AsyncStorage (offline-first)
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
- [ ] **Phase 1** – Erinnerungen (Push), Accounts + Sync (Supabase), Fotos im Journal, Wochenrückblick, teilbare Fortschritts-Karte
- [ ] **Phase 2** – Crews: gemeinsamer Arc mit Freunden, Check-ins sehen, Reaktionen, Rangliste
- [ ] **Phase 3** – Release: App-Icon, Name, Datenschutzerklärung, Sign in with Apple, Account löschen, TestFlight, Store-Einträge
- [ ] Danach – Widgets, Apple Health, weitere Arcs (Spring Arc …)
