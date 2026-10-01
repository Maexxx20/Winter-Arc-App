import type de from '../de/date';
import type { DictOf } from '../../types';

const date: DictOf<typeof de> = {
  weekdays: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
  weekdaysShort: ['lu', 'ma', 'me', 'gi', 've', 'sa', 'do'],
  months: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  monthsShort: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  long: '{weekday} {day} {month}',
  short: '{day} {month}',
  withYear: '{date} {year}',
  numeric: '{day}.{month}.{year}',
  today: 'Oggi',
  yesterday: 'Ieri',
  tomorrow: 'Domani',
};
export default date;
