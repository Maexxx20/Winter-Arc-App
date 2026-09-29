import type { RuleCategory, RuleFrequency, RuleMeasure } from './types';

export interface RuleTemplate {
  title: string;
  icon: string;
  category: RuleCategory;
  frequency: RuleFrequency;
  measure: RuleMeasure;
}

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  body: 'Körper',
  mind: 'Kopf',
  discipline: 'Disziplin',
  growth: 'Wachstum',
};

export const RULE_TEMPLATES: RuleTemplate[] = [
  // Körper
  { title: 'Training', icon: '🏋️', category: 'body', frequency: { kind: 'weekly', times: 4 }, measure: { kind: 'check' } },
  { title: '10 000 Schritte', icon: '🚶', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { title: 'Wasser trinken', icon: '💧', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 2, unit: 'Liter' } },
  { title: 'Kalt duschen', icon: '🧊', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { title: 'Kein Fast Food', icon: '🥗', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { title: 'Protein-Ziel', icon: '🍳', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 120, unit: 'g' } },
  // Kopf
  { title: 'Lesen', icon: '📖', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 10, unit: 'Seiten' } },
  { title: 'Journaling', icon: '✍️', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { title: 'Meditieren', icon: '🧘', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 10, unit: 'Min' } },
  { title: 'Draussen sein', icon: '🌲', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 20, unit: 'Min' } },
  // Disziplin
  { title: 'Früh aufstehen', icon: '⏰', category: 'discipline', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { title: 'Kein Doomscrolling', icon: '📵', category: 'discipline', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { title: 'Vor 23 Uhr schlafen', icon: '🌙', category: 'discipline', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { title: 'Kein Alkohol', icon: '🚫', category: 'discipline', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  // Wachstum
  { title: 'Deep Work', icon: '🎯', category: 'growth', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 60, unit: 'Min' } },
  { title: 'Lernen', icon: '🧠', category: 'growth', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 30, unit: 'Min' } },
  { title: 'An eigenem Projekt arbeiten', icon: '🛠️', category: 'growth', frequency: { kind: 'weekly', times: 3 }, measure: { kind: 'check' } },
  { title: 'Sparen statt ausgeben', icon: '💰', category: 'growth', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
];

export const ICON_CHOICES = [
  '🏋️', '🏃', '🚶', '🚴', '🏊', '🧘', '💧', '🧊', '🥗', '🍳', '📖', '✍️', '🧠', '🎯',
  '⏰', '🌙', '📵', '🚫', '🌲', '🛠️', '💰', '🎸', '🗣️', '🧹', '🙏', '❄️', '🔥', '⭐',
];

/** Empfehlung: 3–5 Regeln. Mehr führt schnell zu Überforderung. */
export const RECOMMENDED_MAX_RULES = 5;
export const HARD_MAX_RULES = 8;

export function describeRule(r: { frequency: RuleFrequency; measure: RuleMeasure }): string {
  const amount = r.measure.kind === 'amount' ? `${formatNumber(r.measure.target)} ${r.measure.unit}` : null;
  const freq = r.frequency.kind === 'daily' ? 'täglich' : `${r.frequency.times}× pro Woche`;
  return amount ? `${amount} · ${freq}` : freq;
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}
