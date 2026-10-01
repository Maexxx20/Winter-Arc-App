import { t } from '@/i18n';

import type { HealthLink, RuleCategory, RuleFrequency, RuleMeasure } from './types';

export interface RuleTemplate {
  title: string;
  icon: string;
  category: RuleCategory;
  frequency: RuleFrequency;
  measure: RuleMeasure;
  health?: HealthLink;
}

export const RULE_CATEGORIES: RuleCategory[] = ['body', 'mind', 'discipline', 'growth'];

/** Name eines Bereichs in der aktuellen Sprache. */
export function categoryLabel(c: RuleCategory): string {
  return t(`today.categories.${c}`);
}

type TemplateKey =
  | 'training' | 'steps' | 'water' | 'sleep' | 'coldShower' | 'noFastFood' | 'protein'
  | 'read' | 'journaling' | 'meditate' | 'outside'
  | 'earlyRise' | 'noDoomscrolling' | 'bedtime' | 'noAlcohol'
  | 'deepWork' | 'learn' | 'ownProject' | 'save';
/** Übersetzte Einheiten; alles andere (z. B. «g») bleibt, wie es ist. */
type UnitKey = 'liter' | 'pages' | 'min' | 'g';
type TemplateMeasure = { kind: 'check' } | { kind: 'amount'; target: number; unit: UnitKey };
type TemplateDef = Omit<RuleTemplate, 'title' | 'measure'> & { key: TemplateKey; measure: TemplateMeasure };

const TEMPLATE_DEFS: TemplateDef[] = [
  // Körper
  { key: 'training', icon: '🏋️', category: 'body', frequency: { kind: 'weekly', times: 4 }, measure: { kind: 'check' }, health: { metric: 'workout', threshold: 30 } },
  { key: 'steps', icon: '🚶', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' }, health: { metric: 'steps', threshold: 10000 } },
  { key: 'water', icon: '💧', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 2, unit: 'liter' } },
  { key: 'sleep', icon: '🛌', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' }, health: { metric: 'sleep', threshold: 7 } },
  { key: 'coldShower', icon: '🧊', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { key: 'noFastFood', icon: '🥗', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { key: 'protein', icon: '🍳', category: 'body', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 120, unit: 'g' } },
  // Kopf
  { key: 'read', icon: '📖', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 10, unit: 'pages' } },
  { key: 'journaling', icon: '✍️', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { key: 'meditate', icon: '🧘', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 10, unit: 'min' }, health: { metric: 'mindful', threshold: 10 } },
  { key: 'outside', icon: '🌲', category: 'mind', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 20, unit: 'min' } },
  // Disziplin
  { key: 'earlyRise', icon: '⏰', category: 'discipline', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { key: 'noDoomscrolling', icon: '📵', category: 'discipline', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { key: 'bedtime', icon: '🌙', category: 'discipline', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  { key: 'noAlcohol', icon: '🚫', category: 'discipline', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
  // Wachstum
  { key: 'deepWork', icon: '🎯', category: 'growth', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 60, unit: 'min' } },
  { key: 'learn', icon: '🧠', category: 'growth', frequency: { kind: 'daily' }, measure: { kind: 'amount', target: 30, unit: 'min' } },
  { key: 'ownProject', icon: '🛠️', category: 'growth', frequency: { kind: 'weekly', times: 3 }, measure: { kind: 'check' } },
  { key: 'save', icon: '💰', category: 'growth', frequency: { kind: 'daily' }, measure: { kind: 'check' } },
];

function unitLabel(unit: UnitKey): string {
  return unit === 'g' ? 'g' : t(`today.units.${unit}`);
}

/**
 * Regelvorlagen in der aktuellen Sprache. Erst beim Anbieten aufrufen: Wird eine Vorlage
 * übernommen, gehören Titel und Einheit danach dem Nutzer und werden nicht mehr übersetzt.
 */
export function ruleTemplates(): RuleTemplate[] {
  return TEMPLATE_DEFS.map(({ key, measure, ...rest }) => ({
    ...rest,
    title: t(`today.templates.${key}`),
    measure: measure.kind === 'amount' ? { kind: 'amount', target: measure.target, unit: unitLabel(measure.unit) } : measure,
  }));
}

/** Standardeinheit für neue Mengen-Regeln. */
export function defaultUnit(): string {
  return t('today.units.min');
}

export const ICON_CHOICES = [
  '🏋️', '🏃', '🚶', '🚴', '🏊', '🧘', '💧', '🧊', '🥗', '🍳', '📖', '✍️', '🧠', '🎯',
  '⏰', '🌙', '📵', '🚫', '🌲', '🛠️', '💰', '🎸', '🗣️', '🧹', '🙏', '❄️', '🔥', '⭐',
];

/** Empfehlung: 3–5 Regeln. Mehr führt schnell zu Überforderung. */
export const RECOMMENDED_MAX_RULES = 5;
export const HARD_MAX_RULES = 8;

export function describeRule(r: { frequency: RuleFrequency; measure: RuleMeasure }): string {
  const amount = r.measure.kind === 'amount' ? `${formatNumber(r.measure.target)} ${r.measure.unit}` : null;
  const freq = r.frequency.kind === 'daily' ? t('today.rule.daily') : t('today.rule.weekly', { times: r.frequency.times });
  return amount ? `${amount} · ${freq}` : freq;
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', t('today.rule.decimal'));
}
