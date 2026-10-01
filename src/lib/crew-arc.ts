/**
 * Crew-Arc (getestet): eine Vorlage mit Zeitraum und Regeln für die Crew.
 * Wer sie übernimmt, unterschreibt einen eigenen Vertrag und kann ihn danach ändern.
 * Übernommene Regeln behalten die IDs der Vorlage – so lässt sich Regel für Regel vergleichen.
 */

import type { StatusRow } from './crew';
import { type ISODate, maxISO } from './date';
import type { Arc, Rule } from './types';

export type CrewArcRule = Pick<Rule, 'id' | 'title' | 'icon' | 'category' | 'frequency' | 'measure'>;

export interface CrewArc {
  id: string;
  crew_id: string;
  title: string;
  why: string;
  start_date: ISODate;
  end_date: ISODate;
  rules: CrewArcRule[];
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CrewArcSignature {
  crew_arc_id: string;
  user_id: string;
  signed_at: string;
}

/** Schutz vor kaputten Vorlagen (die Datenbank prüft auch, ältere Server aber nicht). */
export function isValidCrewArcRule(r: unknown): r is CrewArcRule {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  const f = x.frequency as Record<string, unknown> | undefined;
  const m = x.measure as Record<string, unknown> | undefined;
  const freqOk = !!f && (f.kind === 'daily' || (f.kind === 'weekly' && typeof f.times === 'number' && f.times >= 1 && f.times <= 7));
  const measureOk =
    !!m && (m.kind === 'check' || (m.kind === 'amount' && typeof m.target === 'number' && m.target > 0 && typeof m.unit === 'string'));
  return typeof x.id === 'string' && typeof x.title === 'string' && x.title.length > 0 && typeof x.icon === 'string' && freqOk && measureOk;
}

export function isValidCrewArc(a: CrewArc): boolean {
  return Array.isArray(a.rules) && a.rules.length > 0 && a.rules.every(isValidCrewArcRule) && a.start_date <= a.end_date;
}

/** Der Crew-Arc, um den es gerade geht: läuft oder kommt noch (der früheste davon). */
export function relevantCrewArc(arcs: CrewArc[], today: ISODate): CrewArc | null {
  const open = arcs.filter((a) => a.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  return open[0] ?? null;
}

/** Regeln für den Crew-Arc: ohne persönliche Health-Verknüpfung, mit festen IDs. */
export function toCrewArcRules(rules: Omit<Rule, 'id' | 'activeFrom'>[], makeId: () => string): CrewArcRule[] {
  return rules.map(({ title, icon, category, frequency, measure }) => ({ id: makeId(), title, icon, category, frequency, measure }));
}

/** Zeitraum, wenn man jetzt unterschreibt: wer später dazukommt, startet heute. */
export function joinPeriod(ca: CrewArc, today: ISODate): { startDate: ISODate; endDate: ISODate } | null {
  if (today > ca.end_date) return null;
  return { startDate: maxISO(ca.start_date, today), endDate: ca.end_date };
}

/** Ist mein Arc schon dieser Crew-Arc? */
export function isMyCrewArc(arc: Arc | null | undefined, ca: CrewArc): boolean {
  return !!arc && arc.status === 'active' && arc.crew?.crewArcId === ca.id;
}

export interface RuleComparison {
  rule: CrewArcRule;
  /** Wer die Regel an dem Tag erfüllt hat */
  doneBy: string[];
}

/** Regel für Regel: wer aus der Crew hat sie an `date` erfüllt? Gezählt werden nur Unterschriebene. */
export function compareRules(ca: CrewArc, signers: string[], rows: StatusRow[], date: ISODate): RuleComparison[] {
  const signed = new Set(signers);
  const today = rows.filter((r) => r.date === date && r.crew_arc_id === ca.id && r.user_id && signed.has(r.user_id));
  return ca.rules.map((rule) => ({
    rule,
    doneBy: today.filter((r) => r.rules_done?.includes(rule.id)).map((r) => r.user_id!),
  }));
}

/** Quote pro Regel über mehrere Tage (für «stärkste» und «schwierigste» Regel der Crew). */
export function crewRuleRates(ca: CrewArc, signers: string[], rows: StatusRow[]): Record<string, number> {
  const signed = new Set(signers);
  const relevant = rows.filter((r) => r.crew_arc_id === ca.id && r.user_id && signed.has(r.user_id));
  const out: Record<string, number> = {};
  for (const rule of ca.rules) {
    out[rule.id] = relevant.length ? relevant.filter((r) => r.rules_done?.includes(rule.id)).length / relevant.length : 0;
  }
  return out;
}
