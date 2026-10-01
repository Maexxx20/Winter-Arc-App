import { getLocales } from 'expo-localization';
import { useEffect } from 'react';
import { AppState as RNAppState } from 'react-native';

import { getLang, type Lang, resolveLang, setLang } from '@/i18n';
import { getState, subscribe } from '@/store/store';

function deviceLanguages(): string[] {
  try {
    return getLocales().map((l) => l.languageTag || l.languageCode || '');
  } catch {
    return [];
  }
}

/** Sprache aus Einstellung und Gerät bestimmen und setzen. */
export function applyLanguage(): Lang {
  const lang = resolveLang(getState().settings.language, deviceLanguages());
  setLang(lang);
  return lang;
}

/** Im Root-Layout: Sprache aktuell halten (Einstellung geändert, Gerätesprache geändert). */
export function useLanguageSync() {
  useEffect(() => {
    applyLanguage();
    let last = getState().settings.language;
    const unsub = subscribe(() => {
      const next = getState().settings.language;
      if (next !== last) {
        last = next;
        applyLanguage();
      }
    });
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') applyLanguage();
    });
    return () => {
      unsub();
      sub.remove();
    };
  }, []);
}

export { getLang };
