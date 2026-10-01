import type de from '../de';
import type { DictOf } from '../../types';
import common from './common';
import crewx from './crewx';
import date from './date';
import language from './language';

const dict: DictOf<typeof de> = { common, crewx, date, language };
export default dict;
