import type de from '../de/extras';
import type { DictOf } from '../../types';

const extras: DictOf<typeof de> = {
  widgetHint: {
    title: 'Mets Nordwand sur ton écran d’accueil',
    ios: 'Appuie longuement sur l’écran d’accueil, touche « + » en haut et cherche « Nordwand ». Dans le widget moyen, tu coches tes règles directement – et il y a aussi des widgets pour l’écran verrouillé.',
    android: 'Appuie longuement sur l’écran d’accueil, choisis « Widgets » et cherche « Nordwand ». Dans le grand widget, tu coches tes règles directement.',
    ok: 'Compris',
  },
  quick: {
    today: 'Cocher aujourd’hui',
    note: 'Écrire une note',
    progress: 'Avant / après',
    crew: 'Crew',
  },
  export: {
    title: 'Exporter les données',
    hint: 'Tous les arcs, coches, notes et bilans dans un fichier – à garder ou à ouvrir dans un tableur. Les photos ne sont pas incluses.',
    json: 'Tout (JSON)',
    csv: 'Tableau (CSV)',
    failed: 'L’export n’a pas fonctionné : {error}',
    dialog: 'Données Nordwand',
    columns: ['Date', 'Arc', 'Règle', 'Valeur', 'Unité', 'Fait', 'Note'],
    yes: 'oui',
    no: 'non',
  },
};
export default extras;
