import type de from '../de/extras';
import type { DictOf } from '../../types';

const extras: DictOf<typeof de> = {
  widgetHint: {
    title: 'Put Nordwand on your home screen',
    ios: 'Long-press the home screen, tap “+” at the top and search for “Nordwand”. In the medium widget you check off rules directly – and there are widgets for the lock screen too.',
    android: 'Long-press the home screen, choose “Widgets” and search for “Nordwand”. In the larger widget you check off rules directly.',
    ok: 'Got it',
  },
  quick: {
    today: 'Check off today',
    note: 'Write a note',
    progress: 'Before / after',
    crew: 'Crew',
  },
  export: {
    title: 'Export data',
    hint: 'All arcs, check-ins, notes and reviews as a file – to keep or to open in a spreadsheet. Photos aren’t included.',
    json: 'Everything (JSON)',
    csv: 'Spreadsheet (CSV)',
    failed: 'The export didn’t work: {error}',
    dialog: 'Nordwand data',
    columns: ['Date', 'Arc', 'Rule', 'Value', 'Unit', 'Done', 'Note'],
    yes: 'yes',
    no: 'no',
  },
};
export default extras;
