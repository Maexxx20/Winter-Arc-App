/** Kleinere Funktionen: Widget-Hinweis, Schnellaktionen, Datenexport */
export default {
  widgetHint: {
    title: 'Nordwand auf den Homescreen',
    ios: 'Lange auf den Homescreen drücken, oben auf «+» tippen und «Nordwand» suchen. Im mittleren Widget hakst du Regeln direkt ab – und für den Sperrbildschirm gibt es eigene Widgets.',
    android: 'Lange auf den Homescreen drücken, «Widgets» wählen und «Nordwand» suchen. Im Widget siehst du Tag, Streak und offene Regeln.',
    ok: 'Verstanden',
  },
  quick: {
    today: 'Heute abhaken',
    note: 'Notiz schreiben',
    progress: 'Vorher / Nachher',
    crew: 'Crew',
  },
  export: {
    title: 'Daten exportieren',
    hint: 'Alle Arcs, Häkchen, Notizen und Rückblicke als Datei – zum Aufbewahren oder für eine Tabelle. Fotos sind nicht dabei.',
    json: 'Alles (JSON)',
    csv: 'Tabelle (CSV)',
    failed: 'Der Export hat nicht geklappt: {error}',
    dialog: 'Nordwand-Daten',
    columns: ['Datum', 'Arc', 'Regel', 'Wert', 'Einheit', 'Erfüllt', 'Notiz'],
    yes: 'ja',
    no: 'nein',
  },
};
