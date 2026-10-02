import type de from '../de/system';
import type { DictOf } from '../../types';

const system: DictOf<typeof de> = {
  tabs: {
    today: 'Aujourd’hui',
    history: 'Historique',
    crew: 'Crew',
    contract: 'Contrat',
  },
  reminders: {
    channel: 'Rappels',
    startEveTitle: 'C’est parti demain',
    startEveBody: 'Ton {title} commence demain. Prépare tout ce soir.',
    firstDayTitle: 'Jour 1. C’est parti.',
    firstDayBody: 'Ton {title} commence aujourd’hui. Tu as signé – maintenant, chaque jour compte.',
    dayTitle: 'Jour {day} sur {total}',
    morningLines: [
      'Un jour après l’autre. Aujourd’hui compte.',
      'Pas de négociation. Commence, tout simplement.',
      'La paroi ne rapetisse pas. C’est toi qui deviens plus fort·e.',
      'La discipline, c’est ce que tu fais quand personne ne regarde.',
      'Des petits pas, chaque jour.',
      'Montre-toi aujourd’hui qui tu veux être.',
      'La motivation va et vient. Tes règles restent.',
    ],
    eveningThinIce: {
      one: 'Raté hier – ne rate pas aujourd’hui aussi. Encore {count} règle à faire.',
      other: 'Raté hier – ne rate pas aujourd’hui aussi. Encore {count} règles à faire.',
    },
    eveningOpen: {
      one: 'Encore {count} règle à faire. Tu vas y arriver.',
      other: 'Encore {count} règles à faire. Tu vas y arriver.',
    },
    eveningLater: 'Tout est coché ? Il est encore temps.',
    checkInTitle: 'Check-in',
    lastDayTitle: 'Dernier jour de ton arc',
    reviewTitle: 'Bilan de la semaine',
    reviewBody: 'Deux minutes : qu’est-ce qui a bien marché, et que te fixes-tu pour la semaine prochaine ?',
  },
  push: {
    noProject: 'L’app n’est pas encore liée à un projet Expo (npx eas-cli@latest init).',
    simulator: 'Les notifications push ne fonctionnent que sur un vrai téléphone.',
    web: 'Les notifications push ne sont disponibles que dans l’app.',
    denied: 'Autorise les notifications pour Nordwand dans les réglages de ton téléphone.',
    signedOut: 'Connecte-toi d’abord.',
    failed: 'Ça n’a pas marché. Réessaie plus tard.',
  },
  auth: {
    notConfigured: 'La synchronisation n’est pas encore configurée.',
    mailFailed: 'L’e-mail n’a pas pu être envoyé. Vérifie les réglages SMTP dans Supabase (hôte, port 587, mot de passe d’app).',
    wrongPassword: 'E-mail ou mot de passe incorrect.',
    wrongCode: 'Le code est incorrect ou a expiré.',
    tooMany: 'Trop de tentatives. Attends un peu et réessaie.',
    invalidEmail: 'Cette adresse e-mail n’est pas valide.',
  },
  sync: {
    crew: 'Crew : {error}',
    profile: 'Profil : {error}',
    photos: 'Photos : {error}',
    photosDelete: 'Les photos n’ont pas pu être supprimées : {error}',
  },
  moderation: {
    blocked: 'Nous ne pouvons pas afficher ça. Choisis une autre formulation.',
  },
};

export default system;
