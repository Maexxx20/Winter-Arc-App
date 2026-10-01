import type de from '../de';
import type { DictOf } from '../../types';
import common from './common';
import crewx from './crewx';
import date from './date';
import extras from './extras';
import language from './language';
import progress from './progress';
import recap from './recap';
import ruleReminder from './ruleReminder';
import widget from './widget';

const dict: DictOf<typeof de> = { common, crewx, date, extras, language, progress, recap, ruleReminder, widget };
export default dict;
