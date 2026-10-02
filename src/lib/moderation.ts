/**
 * Einfacher Wortfilter für Inhalte, die andere sehen (Name, Motto, Crew-Namen, Crew-Arc-Vorlagen).
 * Apple verlangt für Apps mit Inhalten von Nutzern einen Filter (Richtlinie 1.2). Er fängt grobe
 * Beleidigungen, Hass und Sexuelles in DE/EN/FR/IT ab – den Rest regeln Melden, Blockieren und Entfernen.
 */

/** Werden als Teil eines Wortes erkannt (lang genug, um keine harmlosen Wörter zu treffen). */
const PARTS = [
  // Deutsch
  'arschloch', 'wichser', 'hurensohn', 'fotze', 'missgeburt', 'schlampe', 'spast', 'behindi', 'kanake', 'neger', 'schwuchtel',
  'judensau', 'sieg heil', 'heil hitler', 'vergewaltig', 'kinderporno', 'pimmel', 'muschi', 'ficken', 'fick dich', 'bumsen',
  // Englisch
  'fuck', 'motherf', 'shithead', 'bitch', 'asshole', 'nigger', 'nigga', 'faggot', 'whore', 'slut',
  'dickhead', 'pussy', 'porn', 
  // Französisch
  'connard', 'connasse', 'salope', 'encule', 'nique ta', 'batard', 'negre', 'tapette',
  // Italienisch
  'vaffanculo', 'stronzo', 'stronza', 'puttana', 'frocio', 'coglione', 'minchia', 'cazzo', 
];

/** Nur als ganzes Wort (kurz, sonst Fehlalarme wie «Schwanzflosse» oder «Scunthorpe»). */
const WORDS = [
  'fick', 'arsch', 'nutte', 'hure', 'spasti', 'opfer', 'dick', 'cock', 'tits', 'sex', 'kkk', 'merde', 'cul', 'ntm',
  'cunt', 'cunts', 'rapist', 'nazi', 'nazis', 'retard', 'retarded', 'negro', 'negros', 'figa', 'troia', 'pute', 'putes',
];

/** Kleinschrift, ohne Akzente, typische Ersatzzeichen (f*ck, 4ss, 5ex) zurückverwandeln. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[0@]/g, (c) => (c === '0' ? 'o' : 'a'))
    .replace(/1|!/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5|\$/g, 's')
    .replace(/7/g, 't')
    .replace(/\*/g, 'u');
}

/** true, wenn der Text etwas enthält, das wir nicht zeigen wollen. */
export function isObjectionable(text: string | null | undefined): boolean {
  if (!text) return false;
  const n = normalize(text);
  const squashed = n.replace(/[^a-z ]/g, '').replace(/\s+/g, ' ');
  const joined = squashed.replace(/ /g, '');
  if (PARTS.some((p) => (p.includes(' ') ? squashed.includes(p) : joined.includes(p)))) return true;
  const words = n.split(/[^a-z]+/).filter(Boolean);
  return words.some((w) => WORDS.includes(w));
}

/** Erster Text aus einer Liste, der den Filter nicht besteht (oder null). */
export function firstObjectionable(...texts: (string | null | undefined)[]): string | null {
  return texts.find((x) => isObjectionable(x)) ?? null;
}
