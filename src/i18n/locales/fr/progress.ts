import type de from '../de/progress';
import type { DictOf } from '../../types';

const progress: DictOf<typeof de> = {
  title: 'Avant / après',
  intro: 'Ajoute des photos à ton journal – idéalement une fois par semaine, même pose, même lumière. Ici, tu en compares deux et tu regardes l’accéléré.',
  private: 'Rien que pour toi – ton crew ne voit jamais les photos du journal.',
  addToday: 'Ajouter une photo à aujourd’hui',
  allArcs: 'Tous les arcs',
  count: { one: '{count} photo', other: '{count} photos' },
  compare: 'Comparaison',
  before: 'Avant',
  after: 'Après',
  between: { one: '{count} jour d’écart', other: '{count} jours d’écart' },
  pickHint: 'Touche une photo ci-dessous pour la choisir comme avant ou après.',
  setBefore: 'Comme avant',
  setAfter: 'Comme après',
  openDay: 'Ouvrir le jour',
  dragHint: 'Glisse pour comparer',
  timelapse: 'Accéléré',
  play: '▶ Lire',
  stop: '■ Stop',
  shareCompare: 'Partager la comparaison',
  shareTitle: 'Avant / après',
  shareNote: 'Partager est facultatif – l’image ne quitte ton téléphone que si tu l’envoies.',
  all: 'Toutes les photos',
  open: 'Avant / après',
};

export default progress;
