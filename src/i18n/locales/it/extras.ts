import type de from '../de/extras';
import type { DictOf } from '../../types';

const extras: DictOf<typeof de> = {
  widgetHint: {
    title: 'Metti Nordwand nella schermata Home',
    ios: 'Tieni premuto sulla schermata Home, tocca «+» in alto e cerca «Nordwand». Nel widget medio spunti le regole direttamente – e ci sono anche widget per la schermata di blocco.',
    android: 'Tieni premuto sulla schermata Home, scegli «Widget» e cerca «Nordwand». Nel widget più grande spunti le regole direttamente.',
    ok: 'Capito',
  },
  quick: {
    today: 'Spunta oggi',
    note: 'Scrivi una nota',
    progress: 'Prima / dopo',
    crew: 'Crew',
  },
  export: {
    title: 'Esporta i dati',
    hint: 'Tutti gli arc, le spunte, le note e i bilanci in un file – da conservare o da aprire in un foglio di calcolo. Le foto non sono incluse.',
    json: 'Tutto (JSON)',
    csv: 'Tabella (CSV)',
    failed: 'L’esportazione non è riuscita: {error}',
    dialog: 'Dati Nordwand',
    columns: ['Data', 'Arc', 'Regola', 'Valore', 'Unità', 'Fatto', 'Nota'],
    yes: 'sì',
    no: 'no',
  },
};
export default extras;
