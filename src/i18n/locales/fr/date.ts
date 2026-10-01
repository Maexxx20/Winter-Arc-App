import type de from '../de/date';
import type { DictOf } from '../../types';

const date: DictOf<typeof de> = {
  weekdays: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  weekdaysShort: ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'],
  months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  monthsShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  long: '{weekday} {day} {month}',
  short: '{day} {month}',
  withYear: '{date} {year}',
  numeric: '{day}.{month}.{year}',
  today: 'Aujourd’hui',
  yesterday: 'Hier',
  tomorrow: 'Demain',
};
export default date;
