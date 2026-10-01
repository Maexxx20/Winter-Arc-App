import type de from '../de/date';
import type { DictOf } from '../../types';

const date: DictOf<typeof de> = {
  weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  long: '{weekday}, {day} {month}',
  short: '{day} {month}',
  withYear: '{date} {year}',
  numeric: '{day}/{month}/{year}',
  today: 'Today',
  yesterday: 'Yesterday',
  tomorrow: 'Tomorrow',
};
export default date;
