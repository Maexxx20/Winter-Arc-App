import * as WebBrowser from 'expo-web-browser';

import { getLang, type Lang } from '@/i18n';

/**
 * Öffentliche Seiten der App (aus dem Ordner docs/, z. B. über GitHub Pages).
 * Nach dem Veröffentlichen hier die endgültigen Adressen eintragen.
 */
export const WEBSITE_URL = 'https://maexxx20.github.io/Winter-Arc-App/';
/** Datenschutzerklärung auf Deutsch (für die Store-Einträge). In der App `privacyUrl()` verwenden. */
export const PRIVACY_URL = `${WEBSITE_URL}datenschutz.html`;
export const SUPPORT_EMAIL = 'max.ale.konrad@gmail.com';

const PRIVACY_PAGES: Record<Lang, string> = {
  de: 'datenschutz.html',
  en: 'en/privacy.html',
  fr: 'fr/confidentialite.html',
  it: 'it/privacy.html',
};

/** Datenschutzerklärung in der aktuellen Sprache der App. */
export function privacyUrl(lang: Lang = getLang()): string {
  return `${WEBSITE_URL}${PRIVACY_PAGES[lang]}`;
}

export function openLink(url: string) {
  // Datenschutz immer in der Sprache der App öffnen, auch wenn PRIVACY_URL übergeben wird.
  const target = url === PRIVACY_URL ? privacyUrl() : url;
  WebBrowser.openBrowserAsync(target).catch(() => {});
}
