import type de from '../de/common';
import type { DictOf } from '../../types';

const common: DictOf<typeof de> = {
  save: 'Enregistrer',
  cancel: 'Annuler',
  close: 'Fermer',
  delete: 'Supprimer',
  remove: 'Retirer',
  back: 'Retour',
  next: 'Suivant',
  done: 'Terminé',
  edit: 'Modifier',
  share: 'Partager',
  retry: 'Réessayer',
  loading: 'Chargement …',
  ok: 'OK',
  yes: 'Oui',
  no: 'Non',
  later: 'Plus tard',
  error: 'Erreur',
  offline: 'Pas de connexion. Es-tu en ligne ?',
  signInFirst: 'Connecte-toi d’abord.',
  someone: 'Quelqu’un',
  noName: 'Sans nom',
  days: { one: '{count} jour', other: '{count} jours' },
};
export default common;
