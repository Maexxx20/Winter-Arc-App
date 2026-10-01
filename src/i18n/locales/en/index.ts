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
import today from './today';
import contract from './contract';
import history from './history';
import crew from './crew';
import system from './system';

const dict: DictOf<typeof de> = { common, crewx, date, extras, language, progress, recap, ruleReminder, widget, today, contract, history, crew, system };
export default dict;
