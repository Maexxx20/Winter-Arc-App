import type de from '../de/widget';
import type { DictOf } from '../../types';

const widget: DictOf<typeof de> = {
  dayOf: 'Day {day} of {total}',
  dayShort: 'Day',
  inline: 'Day {day}/{total} · 🔥 {streak}',
  today: '{done}/{total} today',
  held: 'Today held ✓',
  allDone: 'All done – strong!',
  streak: { one: '🔥 {count} day', other: '🔥 {count} days' },
  untilStart: { one: 'day until the start', other: 'days until the start' },
  inlineStart: 'Nordwand · starts in {count} d',
  noArc: 'No arc running',
  noArcHint: 'Tap to start the next one.',
  inlineNoArc: 'Nordwand · New arc?',
  open: 'Open',
  label: 'Nordwand',
  description: 'Day of your arc, streak and today’s rules – check them off right here.',
};

export default widget;
