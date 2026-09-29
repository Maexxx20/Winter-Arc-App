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
}

export interface DayEntry {
  /** ruleId → Wert. Abhaken: 1 = erledigt. Menge: erfasste Menge. */
  values: Record<string, number>;
  note?: string;
  updatedAt: string;
}

export interface Settings {
  name: string;
  /** Stunde, zu der ein neuer Tag beginnt (0 = Mitternacht). */
  rolloverHour: number;
  haptics: boolean;
}

export interface AppState {
  schemaVersion: 1;
  arcs: Arc[];
  activeArcId: string | null;
  /** arcId → Datum → Eintrag */
  logs: Record<string, Record<ISODate, DayEntry>>;
  settings: Settings;
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
