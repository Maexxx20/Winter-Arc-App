import { describe, expect, it } from 'vitest';

import { combineWorkoutMinutes, describeHealthLink, healthValueForRule, mergeHealthValue, suggestHealthLink, unionMinutes } from '../health';
import type { Rule } from '../types';

const rule = (title: string, measure: Rule['measure'] = { kind: 'check' }): Rule => ({
  id: 'r', title, icon: '⭐', category: 'body', frequency: { kind: 'daily' }, measure, activeFrom: '2026-10-01',
});

describe('Vorschläge', () => {
  it('erkennt typische Regeln', () => {
    expect(suggestHealthLink(rule("12'000 Schritte"))).toEqual({ metric: 'steps', threshold: 12000 });
    expect(suggestHealthLink(rule('10 000 Schritte'))).toEqual({ metric: 'steps', threshold: 10000 });
    expect(suggestHealthLink(rule('Training'))).toEqual({ metric: 'workout', threshold: 30 });
    expect(suggestHealthLink(rule('Laufen', { kind: 'amount', target: 45, unit: 'Min' }))).toEqual({ metric: 'workout', threshold: 45 });
    expect(suggestHealthLink(rule('Genug schlafen'))).toEqual({ metric: 'sleep', threshold: 7 });
    expect(suggestHealthLink(rule('Vor 23 Uhr schlafen'))).toBeNull();
    expect(suggestHealthLink(rule('Wasser trinken', { kind: 'amount', target: 2, unit: 'Liter' }))).toEqual({ metric: 'water', threshold: 2 });
    expect(suggestHealthLink(rule('Meditieren', { kind: 'amount', target: 15, unit: 'Min' }))).toEqual({ metric: 'mindful', threshold: 15 });
    expect(suggestHealthLink(rule('Lesen'))).toBeNull();
  });
});

describe('Werte für Regeln', () => {
  it('Abhaken ab Schwelle', () => {
    const r = rule('Schritte');
    expect(healthValueForRule(r, { metric: 'steps', threshold: 10000 }, { steps: 12500 })).toBe(1);
    expect(healthValueForRule(r, { metric: 'steps', threshold: 10000 }, { steps: 8000 })).toBeNull();
    expect(healthValueForRule(r, { metric: 'steps', threshold: 10000 }, {})).toBeNull();
  });
  it('Mengen in der Einheit der Regel', () => {
    expect(healthValueForRule(rule('Wasser', { kind: 'amount', target: 2000, unit: 'ml' }), { metric: 'water', threshold: 2 }, { water: 1.5 })).toBe(1500);
    expect(healthValueForRule(rule('Meditieren', { kind: 'amount', target: 10, unit: 'Min' }), { metric: 'mindful', threshold: 10 }, { mindful: 12 })).toBe(12);
    expect(healthValueForRule(rule('Schlaf', { kind: 'amount', target: 8, unit: 'Std' }), { metric: 'sleep', threshold: 8 }, { sleep: 7.25 })).toBe(7.25);
  });
  it('unpassende Einheit: Ziel eintragen, sobald die Schwelle erreicht ist', () => {
    const r = rule('Training', { kind: 'amount', target: 1, unit: 'Einheit' });
    expect(healthValueForRule(r, { metric: 'workout', threshold: 30 }, { workout: 45 })).toBe(1);
    expect(healthValueForRule(r, { metric: 'workout', threshold: 30 }, { workout: 20 })).toBeNull();
  });
});

describe('Zusammenführen', () => {
  it('Health hebt nur an', () => {
    const check = rule('Schritte');
    expect(mergeHealthValue(check, 0, 1)).toBe(1);
    expect(mergeHealthValue(check, 1, 1)).toBeNull();
    expect(mergeHealthValue(check, 0, null)).toBeNull();
    const amount = rule('Wasser', { kind: 'amount', target: 2, unit: 'Liter' });
    expect(mergeHealthValue(amount, 1, 1.5)).toBe(1.5);
    expect(mergeHealthValue(amount, 2.5, 1.5)).toBeNull(); // von Hand mehr eingetragen
  });
  it('Workouts aus zwei Quellen zählen nicht doppelt', () => {
    expect(combineWorkoutMinutes(40, 45)).toBe(45);
    expect(combineWorkoutMinutes(undefined, 30)).toBe(30);
    expect(combineWorkoutMinutes(undefined, undefined)).toBeUndefined();
  });
  it('Beschreibung', () => {
    expect(describeHealthLink({ metric: 'steps', threshold: 10000 })).toMatch(/^🚶 ab 10.000 Schritte$|^🚶 ab 10’000 Schritte$|^🚶 ab 10'000 Schritte$/);
    expect(describeHealthLink({ metric: 'sleep', threshold: 7.5 })).toBe('🛌 ab 7,5 Std');
  });
});

describe('Zeiträume ohne Überlappung', () => {
  const m = 60000;
  it('zählt Überlappungen einmal', () => {
    expect(unionMinutes([{ start: 0, end: 60 * m }, { start: 30 * m, end: 90 * m }, { start: 120 * m, end: 130 * m }])).toBe(100);
  });
  it('leer = 0', () => {
    expect(unionMinutes([])).toBe(0);
  });
});
