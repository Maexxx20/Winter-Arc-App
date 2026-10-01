import type de from '../de/widget';
import type { DictOf } from '../../types';

const widget: DictOf<typeof de> = {
  dayOf: 'Giorno {day} di {total}',
  dayShort: 'Giorno',
  inline: 'Giorno {day}/{total} · 🔥 {streak}',
  today: '{done}/{total} oggi',
  held: 'Giornata tenuta ✓',
  allDone: 'Tutto fatto – grande!',
  streak: { one: '🔥 {count} giorno', other: '🔥 {count} giorni' },
  untilStart: { one: 'giorno all’inizio', other: 'giorni all’inizio' },
  inlineStart: 'Nordwand · inizia tra {count} g',
  noArc: 'Nessun arc in corso',
  noArcHint: 'Tocca per iniziare il prossimo.',
  inlineNoArc: 'Nordwand · Nuovo arc?',
  open: 'Aperto',
  label: 'Nordwand',
  description: 'Giorno del tuo arc, serie e regole di oggi – da spuntare subito.',
};

export default widget;
