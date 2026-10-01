import type de from '../de/ruleReminder';
import type { DictOf } from '../../types';

const ruleReminder: DictOf<typeof de> = {
  sheetLabel: 'Impostazioni della regola',
  section: 'Promemoria',
  label: 'Ricordamelo alle',
  hint: 'Solo nei giorni in cui la regola è ancora aperta',
  title: '{icon} {title}',
  body: 'È ora di «{title}». Non dimenticare di spuntarla dopo.',
  bodyAmount: 'È ora di «{title}»: oggi {target} {unit}.',
  bodyWeekly: { one: '«{title}»: ancora {count} volta questa settimana.', other: '«{title}»: ancora {count} volte questa settimana.' },
  inline: 'Promemoria alle {time}',
};
export default ruleReminder;
