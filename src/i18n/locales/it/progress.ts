import type de from '../de/progress';
import type { DictOf } from '../../types';

const progress: DictOf<typeof de> = {
  title: 'Prima / dopo',
  intro: 'Aggiungi foto al tuo diario – idealmente una volta a settimana, stessa posa, stessa luce. Qui ne confronti due e guardi il timelapse.',
  private: 'Solo per te – la tua crew non vede mai le foto del diario.',
  addToday: 'Aggiungi una foto a oggi',
  allArcs: 'Tutti gli arc',
  count: { one: '{count} foto', other: '{count} foto' },
  compare: 'Confronto',
  before: 'Prima',
  after: 'Dopo',
  between: { one: '{count} giorno di distanza', other: '{count} giorni di distanza' },
  pickHint: 'Tocca una foto qui sotto per sceglierla come prima o dopo.',
  setBefore: 'Come prima',
  setAfter: 'Come dopo',
  openDay: 'Apri il giorno',
  dragHint: 'Trascina per confrontare',
  timelapse: 'Timelapse',
  play: '▶ Riproduci',
  stop: '■ Stop',
  shareCompare: 'Condividi il confronto',
  shareTitle: 'Prima / dopo',
  shareNote: 'Condividere è facoltativo – l’immagine lascia il telefono solo se la invii tu.',
  all: 'Tutte le foto',
  open: 'Prima / dopo',
};

export default progress;
