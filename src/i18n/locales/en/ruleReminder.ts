import type de from '../de/ruleReminder';
import type { DictOf } from '../../types';

const ruleReminder: DictOf<typeof de> = {
  sheetLabel: 'Rule settings',
  section: 'Reminder',
  label: 'Remind me at',
  hint: 'Only on days when the rule is still open',
  title: '{icon} {title}',
  body: 'Time for “{title}”. Don’t forget to check it off afterwards.',
  bodyAmount: 'Time for “{title}”: {target} {unit} today.',
  bodyWeekly: { one: '“{title}”: {count} more time this week.', other: '“{title}”: {count} more times this week.' },
  inline: 'Reminder at {time}',
};
export default ruleReminder;
