import type de from '../de/ruleReminder';
import type { DictOf } from '../../types';

const ruleReminder: DictOf<typeof de> = {
  sheetLabel: 'Réglages de la règle',
  section: 'Rappel',
  label: 'Me rappeler à',
  hint: 'Seulement les jours où la règle n’est pas encore faite',
  title: '{icon} {title}',
  body: 'C’est l’heure de « {title} ». N’oublie pas de cocher ensuite.',
  bodyAmount: 'C’est l’heure de « {title} » : {target} {unit} aujourd’hui.',
  bodyWeekly: { one: '« {title} » : encore {count} fois cette semaine.', other: '« {title} » : encore {count} fois cette semaine.' },
  inline: 'Rappel à {time}',
};
export default ruleReminder;
