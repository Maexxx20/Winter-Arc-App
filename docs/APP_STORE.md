# App Store & Google Play – Texte und Angaben

Alles zum Kopieren in App Store Connect bzw. die Google Play Console. Sprache: Deutsch.

## Grunddaten

| Feld | Wert |
|---|---|
| Name (max. 30) | **Nordwand** |
| Untertitel (max. 30) | **Winter Arc Tracker** |
| Bundle-ID / Package | `ch.maxkon.nordwand` |
| Kategorie | Gesundheit & Fitness (zweite: Produktivität) |
| Preis | Gratis |
| Altersfreigabe | Fragebogen ehrlich ausfüllen: Crews zeigen Profilbild, Name, Motto, Zahlen und Emojis nur innerhalb privater Gruppen (Beitritt nur per Code). Mitglieder können über «Melden» eine Mail an den Support schicken. |
| Datenschutz-URL | `https://maexxx20.github.io/Winter-Arc-App/datenschutz.html` (oder eigene Domain) |
| Support-URL | `https://maexxx20.github.io/Winter-Arc-App/` |

## Werbetext (max. 170)

> Die letzten 92 Tage des Jahres zählen. Unterschreib deinen Vertrag, hak jeden Tag ab und zieh deinen Winter Arc durch – allein oder mit deiner Crew.

## Schlüsselwörter (max. 100, mit Komma, ohne Leerzeichen danach)

```
winter arc,habit tracker,gewohnheit,challenge,disziplin,routine,streak,lock in,90 tage,ziele,fitness
```

## Beschreibung

```
Während alle anderen in den Winterschlaf gehen, ziehst du durch.

Nordwand ist dein Tracker für den Winter Arc: 92 Tage vom 1. Oktober bis Silvester, in denen du Gewohnheiten aufbaust und als bessere Version ins neue Jahr startest. Du kannst jederzeit einsteigen – auch mitten im Winter.

DEINE REGELN, DEIN VERTRAG
Wähle 3–5 Regeln aus Vorlagen oder schreib eigene: täglich oder x-mal pro Woche, abhaken oder Mengen erfassen (10 Seiten lesen, 2 Liter Wasser, 30 Minuten Deep Work). Dann unterschreibst du deinen Vertrag mit dir selbst. Danach darfst du ihn nur noch dreimal ändern.

NIE ZWEIMAL VERPASSEN
Ein verpasster Tag ist kein Scheitern – die Forschung zeigt, dass er der Gewohnheitsbildung kaum schadet. Darum fängt dein Schild pro Woche einen einzelnen verpassten Tag auf. Erst zwei Tage in Folge brechen deinen Streak.

JEDEN TAG SICHTBAR
• Bogen-Anzeige: Tag 24 von 92 und dein Fortschritt heute
• Heatmap über den ganzen Arc
• Quote pro Regel und die 66-Tage-Marke im Blick
• Tagebuch mit Notizen und Fotos
• Wochenrückblick jeden Sonntag

ERINNERUNGEN, DIE MITDENKEN
Morgens ein kurzer Anstoss, abends ein Check-in – aber nur, wenn noch etwas offen ist.

ZUSAMMEN MIT DEINER CREW
Lade Freunde, Team oder Klasse mit einem Code ein. Ihr seht, wer seinen Tag gehalten hat, vergleicht Streak und Quote und feuert euch mit Reaktionen an. Tippe auf jemanden und sieh Profilbild, Motto und Streak. Deine Regeln, Notizen und Fotos bleiben privat – geteilt werden nur dein Profil und Zahlen.

TEILEN
Mach aus deinem Fortschritt eine Karte im Story-Format und zeig, dass du dranbleibst.

PRIVAT
Funktioniert komplett ohne Konto. Mit Konto werden deine Daten gesichert und zwischen Geräten abgeglichen. Keine Werbung, kein Tracking.
```

## Neuerungen (erste Version)

```
Die erste Version von Nordwand – bereit für deinen Winter Arc.
```

## App-Datenschutz («Nutrition Label») in App Store Connect

Tracking: **Nein** (keine Daten werden zum Tracking verwendet).

| Datentyp | Erhoben? | Mit Identität verknüpft | Zweck |
|---|---|---|---|
| Kontaktinfos → E-Mail-Adresse | Ja (nur mit Konto) | Ja | App-Funktionalität |
| Nutzerinhalte → Andere Nutzerinhalte (Regeln, Häkchen, Notizen, Rückblicke, Profil: Name, Motto, Instagram-Name) | Ja (nur mit Konto) | Ja | App-Funktionalität |
| Kennungen → Nutzer-ID | Ja (nur mit Konto) | Ja | App-Funktionalität |
| Nutzerinhalte → Fotos oder Videos | Ja (Profilbild und Tagebuch-Fotos, nur mit Konto) | Ja | App-Funktionalität |
| Kennungen → Geräte-ID (Push-Token) | Ja (nur wenn Crew-Mitteilungen eingeschaltet) | Ja | App-Funktionalität |
| Nutzungsdaten, Diagnose, Standort, Gesundheit | Nein | – | – |

Google Play → «Datensicherheit»: dieselben Angaben; Daten werden verschlüsselt übertragen; Nutzer können die Löschung in der App anfordern (Konto löschen).

## Hinweise für die App-Review

```
Nordwand funktioniert vollständig ohne Konto: Beim ersten Start einen Arc erstellen (Zeitraum, Regeln, Vertrag gedrückt halten zum Unterschreiben).

Für Konto, Sync und Crews bitte dieses Test-Konto verwenden (meldet sich mit Passwort statt E-Mail-Code an):
E-Mail: [REVIEW-E-MAIL]
Passwort: [REVIEW-PASSWORT]

Im Tab «Crew» ist das Test-Konto bereits Mitglied der Crew «Review Crew» mit Beispieldaten.
Konto löschen: Tab «Vertrag» → «Konto & Sync» → «Konto löschen».
```

## Screenshots

App Store verlangt Bilder für das 6,9"-iPhone (1320 × 2868 oder 1290 × 2796). Am besten direkt auf dem
iPhone aufnehmen (Development- oder TestFlight-Build) mit Beispieldaten. Vorschlag für 5 Bilder:

1. **Heute** – Bogen «Tag 24 von 92», Regeln halb abgehakt → «Jeden Tag ein Stück höher»
2. **Vertrag unterschreiben** → «Gib dir dein Wort»
3. **Verlauf/Heatmap** → «Dein ganzer Winter auf einen Blick»
4. **Crew-Rangliste** → «Zusammen durchziehen»
5. **Teilen-Karte** → «Zeig, dass du dranbleibst»
