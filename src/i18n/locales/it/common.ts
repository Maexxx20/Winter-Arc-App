import type de from '../de/common';
import type { DictOf } from '../../types';

const common: DictOf<typeof de> = {
  save: 'Salva',
  cancel: 'Annulla',
  close: 'Chiudi',
  delete: 'Elimina',
  remove: 'Rimuovi',
  back: 'Indietro',
  next: 'Avanti',
  done: 'Fatto',
  edit: 'Modifica',
  share: 'Condividi',
  retry: 'Riprova',
  loading: 'Caricamento …',
  ok: 'OK',
  yes: 'Sì',
  no: 'No',
  later: 'Più tardi',
  error: 'Errore',
  offline: 'Nessuna connessione. Sei online?',
  signInFirst: 'Prima accedi.',
  someone: 'Qualcuno',
  noName: 'Senza nome',
  days: { one: '{count} giorno', other: '{count} giorni' },
};
export default common;
