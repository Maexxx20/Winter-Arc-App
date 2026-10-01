/**
 * Übersetzungen (Deutsch, Englisch, Französisch, Italienisch).
 *
 * - `t('crew.title')` liefert den Text in der aktuellen Sprache, `t('x', { name: 'Lara' })` setzt {name} ein.
 * - Einzahl/Mehrzahl: Eintrag `{ one, other }` und `t('x', { count: 3 })`.
 * - Listen (Wochentage …): `tl('date.weekdays')`.
 * - Texte nie beim Laden eines Moduls in Konstanten speichern, sonst bleiben sie nach einem
 *   Sprachwechsel in der alten Sprache. Immer erst beim Anzeigen `t()` aufrufen.
 *
 * Bewusst ohne Expo-Abhängigkeit, damit die reinen Funktionen in lib/ testbar bleiben.
 * Die Gerätesprache setzt services/language.ts.
 */
import { useSyncExternalStore } from 'react';

import de from './locales/de';
import en from './locales/en';
import fr from './locales/fr';
import it from './locales/it';
import type { ListPaths, Paths, Plural } from './types';

export type Lang = 'de' | 'en' | 'fr' | 'it';
export type LangSetting = Lang | 'system';
export const LANGS: Lang[] = ['de', 'en', 'fr', 'it'];
export const LANG_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English', fr: 'Français', it: 'Italiano' };

export type Dict = typeof de;
export type TKey = Paths<Dict>;
export type TListKey = ListPaths<Dict>;

const DICTS: Record<Lang, Dict> = { de, en, fr, it } as Record<Lang, Dict>;

let current: Lang = 'de';
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  for (const l of listeners) l();
}

/** Für Komponenten, die bei einem Sprachwechsel neu zeichnen müssen. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}

export function onLangChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Sprache aus Einstellung und Gerätesprachen (bevorzugte zuerst). Unbekannt → Englisch. */
export function resolveLang(setting: LangSetting | undefined, deviceLanguages: string[]): Lang {
  if (setting && setting !== 'system') return setting;
  for (const code of deviceLanguages) {
    const base = code.toLowerCase().split(/[-_]/)[0] as Lang;
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

/** Sprach-Tag für Zahlen und Datumsformate (Schweizer Varianten). */
export function localeTag(lang: Lang = current): string {
  return { de: 'de-CH', en: 'en-GB', fr: 'fr-CH', it: 'it-CH' }[lang];
}

function lookup(dict: Dict, key: string): unknown {
  let v: unknown = dict;
  for (const part of key.split('.')) {
    if (v && typeof v === 'object') v = (v as Record<string, unknown>)[part];
    else return undefined;
  }
  return v;
}

const isPlural = (v: unknown): v is Plural => !!v && typeof v === 'object' && !Array.isArray(v) && 'other' in v;

function fill(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export function t(key: TKey, vars?: Record<string, string | number>): string {
  let v = lookup(DICTS[current], key);
  if (v === undefined) v = lookup(DICTS.de, key);
  if (isPlural(v)) {
    const n = Number(vars?.count ?? 0);
    // Französisch: 0 und 1 sind Einzahl («0 jour»)
    const singular = current === 'fr' ? Math.abs(n) < 2 : n === 1;
    v = singular ? v.one : v.other;
  }
  if (typeof v !== 'string') return key;
  return fill(v, vars);
}

export function tl(key: TListKey): readonly string[] {
  const v = lookup(DICTS[current], key) ?? lookup(DICTS.de, key);
  return Array.isArray(v) ? v : [];
}

/** Zahl im Format der Sprache (10’000 / 10,000 / 10 000). */
export function formatNumber(n: number, digits?: number): string {
  return n.toLocaleString(localeTag(), digits === undefined ? undefined : { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
