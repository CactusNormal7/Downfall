import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { Dictionary } from '../src/dict/dictionary.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Dictionnaire complet, charge une fois pour toute la suite. */
export const fullDictionary = Dictionary.fromText(
  readFileSync(resolve(HERE, '../src/dict/words-fr.txt'), 'utf8'),
);

/** Dictionnaire minimal : rend les tests de regles independants du vrai lexique. */
export function tinyDictionary(words: string[]): Dictionary {
  return new Dictionary(words);
}
