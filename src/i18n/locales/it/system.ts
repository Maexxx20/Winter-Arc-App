import type de from '../de/system';
import type { DictOf } from '../../types';

const system: DictOf<typeof de> = {
  tabs: {
    today: 'Oggi',
    history: 'Cronologia',
    crew: 'Crew',
    contract: 'Contratto',
  },
  reminders: {
    channel: 'Promemoria',
    startEveTitle: 'Domani si parte',
    startEveBody: 'Il tuo {title} inizia domani. Prepara tutto stasera.',
    firstDayTitle: 'Giorno 1. Si parte.',
    firstDayBody: 'Oggi inizia il tuo {title}. Hai firmato – ora ogni giorno conta.',
    dayTitle: 'Giorno {day} di {total}',
    morningLines: [
      'Un giorno alla volta. Oggi conta.',
      'Niente trattative. Inizia e basta.',
      'La parete non diventa più piccola. Sei tu a diventare più forte.',
      'La disciplina è ciò che fai quando nessuno ti guarda.',
      'Piccoli passi, ogni giorno.',
      'Mostrati oggi chi vuoi essere.',
      'La motivazione va e viene. Le tue regole restano.',
    ],
    eveningThinIce: {
      one: 'Ieri hai saltato – non saltare anche oggi. Ancora {count} regola da fare.',
      other: 'Ieri hai saltato – non saltare anche oggi. Ancora {count} regole da fare.',
    },
    eveningOpen: {
      one: 'Ancora {count} regola da fare. Ce la fai.',
      other: 'Ancora {count} regole da fare. Ce la fai.',
    },
    eveningLater: 'Hai già spuntato tutto? C’è ancora tempo.',
    checkInTitle: 'Check-in',
    lastDayTitle: 'Ultimo giorno del tuo arc',
    reviewTitle: 'Bilancio della settimana',
    reviewBody: 'Due minuti: cosa è andato bene e cosa ti proponi per la prossima settimana?',
  },
  push: {
    noProject: 'L’app non è ancora collegata a un progetto Expo (npx eas-cli@latest init).',
    simulator: 'Le notifiche push funzionano solo su un telefono vero.',
    web: 'Le notifiche push sono disponibili solo nell’app.',
    denied: 'Consenti le notifiche per Nordwand nelle impostazioni del telefono.',
    signedOut: 'Accedi prima.',
    failed: 'Non ha funzionato. Riprova più tardi.',
  },
  auth: {
    notConfigured: 'La sincronizzazione non è ancora configurata.',
    mailFailed: 'Impossibile inviare l’e-mail. Controlla le impostazioni SMTP in Supabase (host, porta 587, password per app).',
    wrongPassword: 'E-mail o password errata.',
    wrongCode: 'Il codice è errato o scaduto.',
    tooMany: 'Troppi tentativi. Aspetta un attimo e riprova.',
    invalidEmail: 'Questo indirizzo e-mail non è valido.',
  },
  sync: {
    crew: 'Crew: {error}',
    profile: 'Profilo: {error}',
    photos: 'Foto: {error}',
    photosDelete: 'Impossibile eliminare le foto: {error}',
  },
  moderation: {
    blocked: 'Non possiamo mostrarlo. Scegli un’altra formulazione.',
  },
};

export default system;
