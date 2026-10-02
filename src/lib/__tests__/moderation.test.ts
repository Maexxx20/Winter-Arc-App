import { describe, expect, it } from 'vitest';

import { firstObjectionable, isObjectionable } from '../moderation';

describe('Wortfilter', () => {
  it('erkennt grobe Wörter in vier Sprachen, auch verschleiert', () => {
    for (const bad of ['Du Arschloch', 'f*ck you', 'FUCK', 'sieg  heil', 'connard', 'Vaffanculo', 'h.u.r.e.n.s.o.h.n', 'Ar5chl0ch', 'fick', 'du nazi', 'SCUNT'.slice(1)]) {
      expect(isObjectionable(bad)).toBe(true);
    }
  });
  it('lässt normale Texte durch', () => {
    for (const ok of ['Mäx', 'Goalie. Kein Tag ohne Training.', 'Eishockey Crew Aarau', 'Schwanzflosse', 'Scunthorpe', 'Kalt duschen', 'Arschbombe im See', 'Dickens lesen', 'Computer', 'Sexta', 'Ignazio', 'Montenegro', 'Negroni', 'therapist', 'retarder le départ', 'Pédale douce', '', null]) {
      expect(isObjectionable(ok)).toBe(false);
    }
  });
  it('erster auffälliger Text', () => {
    expect(firstObjectionable('Lara', 'du bitch', 'x')).toBe('du bitch');
    expect(firstObjectionable('Lara', undefined)).toBeNull();
  });
});
