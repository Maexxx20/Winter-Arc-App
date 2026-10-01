import type de from '../de/widget';
import type { DictOf } from '../../types';

const widget: DictOf<typeof de> = {
  dayOf: 'Jour {day} sur {total}',
  dayShort: 'Jour',
  inline: 'Jour {day}/{total} · 🔥 {streak}',
  today: '{done}/{total} aujourd’hui',
  held: 'Journée tenue ✓',
  allDone: 'Tout est fait – bravo !',
  streak: { one: '🔥 {count} jour', other: '🔥 {count} jours' },
  untilStart: { one: 'jour avant le début', other: 'jours avant le début' },
  inlineStart: 'Nordwand · début dans {count} j',
  noArc: 'Aucun arc en cours',
  noArcHint: 'Touche pour lancer le prochain.',
  inlineNoArc: 'Nordwand · Nouvel arc ?',
  open: 'Ouvert',
  label: 'Nordwand',
  description: 'Jour de ton arc, série et règles du jour – à cocher directement.',
};

export default widget;
