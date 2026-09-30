import * as WebBrowser from 'expo-web-browser';

/**
 * Öffentliche Seiten der App (aus dem Ordner docs/, z. B. über GitHub Pages).
 * Nach dem Veröffentlichen hier die endgültigen Adressen eintragen.
 */
export const WEBSITE_URL = 'https://maexxx20.github.io/Winter-Arc-App/';
export const PRIVACY_URL = `${WEBSITE_URL}datenschutz.html`;

export function openLink(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
