import { describe, expect, it } from 'vitest';

import { cleanInstagram, instagramUrl } from '../profile';

describe('cleanInstagram', () => {
  it('entfernt @ und Leerzeichen', () => {
    expect(cleanInstagram('  @maexxx20 ')).toBe('maexxx20');
  });
  it('nimmt den Namen aus einem Link', () => {
    expect(cleanInstagram('https://www.instagram.com/max.k_20/?hl=de')).toBe('max.k_20');
  });
  it('lässt nur erlaubte Zeichen zu, max. 30', () => {
    expect(cleanInstagram('Mäx Konrad!')).toBe('MxKonrad');
    expect(cleanInstagram('a'.repeat(40))).toHaveLength(30);
  });
  it('leer bleibt leer', () => {
    expect(cleanInstagram('@')).toBe('');
  });
});

describe('instagramUrl', () => {
  it('baut den Profil-Link', () => {
    expect(instagramUrl('maexxx20')).toBe('https://instagram.com/maexxx20');
  });
});
