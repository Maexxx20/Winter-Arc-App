import type { ISODate } from './date';

export type RuleFrequency =
  | { kind: 'daily' }
  | { kind: 'weekly'; times: number }; // z. B. "Training 4× pro Woche"

export type RuleMeasure =
  | { kind: 'check' } // abhaken
  | { kind: 'amount'; target: number; unit: string }; // z. B. 20 Seiten, 2 Liter

export type RuleCategory = 'body' | 'mind' | 'discipline' | 'growth';

export interface Rule {
  id: string;
  title: string;
  icon: string; // Emoji
  category: RuleCategory;
  frequency: RuleFrequency;
  measure: RuleMeasure;
  /** Erster Tag, an dem die Regel gilt. */
  activeFrom: ISODate;
  /** Ab diesem Tag gilt die Regel nicht mehr (exklusiv). */
  removedOn?: ISODate;
}

export interface Signature {
  name: string;
  signedAt: string; // ISO-Zeitstempel
}

export type ArcStatus = 'active' | 'finished' | 'abandoned';

export interface Arc {
  id: string;
  title: string;
  startDate: ISODate;
  endDate: ISODate; // inklusiv
  why: string; // "Warum mache ich das?"
  rules: Rule[];
  signature?: Signature;
  /** Nach dem Unterschreiben: wie oft der Vertrag noch geändert werden darf. */
  amendmentsLeft: number;
  status: ArcStatus;
  createdAt: string;
  /** Letzte Änderung (für den Sync: neuere Version gewinnt). */
  updatedAt?: string;
}

export interface DayEntry {
  /** ruleId → Wert. Abhaken: 1 = erledigt. Menge: erfasste Menge. */
  values: Record<string, number>;
  note?: string;
  /** Lokale Datei-URIs der Fotos (im App-Dokumentenordner). */
  photos?: string[];
  updatedAt: string;
}

/** Minuten seit Mitternacht, z. B. 7:30 = 450. */
export type TimeOfDay = number;

export interface ReminderSettings {
  /** null = noch nie gefragt, false = aus */
  enabled: boolean | null;
  morning: TimeOfDay | null;
  evening: TimeOfDay | null;
  weeklyReview: boolean;
}

export interface WeekReview {
  /** 1–5: Wie war die Woche? */
  rating: number;
  wins: string;
  obstacles: string;
  nextWeek: string;
  updatedAt: string;
}

export interface Avatar {
  /** Datei im Dokumentenordner der App (relativer Name) – null, wenn nur auf dem Server. */
  local: string | null;
  /** Pfad im Speicher-Bucket «avatars» – null, solange nicht hochgeladen. */
  remote: string | null;
}

export interface Settings {
  /** Anzeigename; erscheint im Vertrag und in Crews. */
  name: string;
  /** Kurzer Satz über dich, max. 80 Zeichen. Sichtbar für Crews. */
  motto: string;
  /** Instagram-Name ohne @. Sichtbar für Crews. */
  instagram: string;
  avatar: Avatar;
  /** Letzte Änderung an Name, Motto, Instagram oder Bild (für den Sync). null = nie bearbeitet. */
  profileUpdatedAt: string | null;
  /** Stunde, zu der ein neuer Tag beginnt (0 = Mitternacht). */
  rolloverHour: number;
  haptics: boolean;
  reminders: ReminderSettings;
}

export interface AppState {
  schemaVersion: 1;
  arcs: Arc[];
  activeArcId: string | null;
  /** arcId → Datum → Eintrag */
  logs: Record<string, Record<ISODate, DayEntry>>;
  /** arcId → Wochenstart (Montag) → Rückblick */
  reviews: Record<string, Record<ISODate, WeekReview>>;
  settings: Settings;
  /** Stand des Server-Abgleichs (nur wenn angemeldet). */
  sync?: SyncMeta;
}

export interface SyncMeta {
  /** Lokale Zeit des letzten erfolgreichen Uploads. */
  lastPushedAt: string | null;
  /** Server-Zeit (server_updated_at) des neuesten heruntergeladenen Datensatzes. */
  lastPulledAt: string | null;
  /** Zu welchem Konto gehört der Stand? */
  userId: string | null;
}

export type DayStatus =
  | 'done' // alle täglichen Regeln erfüllt
  | 'partial' // teilweise erfüllt
  | 'missed' // nichts erfüllt
  | 'shielded' // verpasst, aber vom Schild gerettet
  | 'open' // heute, noch nicht fertig
  | 'future'
  | 'outside' // ausserhalb des Arcs
  | 'neutral'; // keine täglichen Regeln aktiv
