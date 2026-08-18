import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { Dictionary } from '../src/dict/dictionary.js';
import { GRID_COLS, GRID_ROWS } from '../src/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Dictionnaire complet, charge une fois pour toute la suite. */
export const fullDictionary = Dictionary.fromText(
  readFileSync(resolve(HERE, '../src/dict/words-fr.txt'), 'utf8'),
);

/** Dictionnaire minimal : rend les tests de regles independants du vrai lexique. */
export function tinyDictionary(words: string[]): Dictionary {
  return new Dictionary(words);
}

/**
 * Construit une grille aux dimensions reelles du jeu a partir de quelques
 * lignes ASCII posees en bas. Les lignes plus courtes que la grille sont
 * completees a droite, et le vide est ajoute au-dessus.
 *
 * Sans ce helper, coller une ligne de 8 caracteres dans une grille de 12
 * colonnes produit une grille en dents de scie : les tests passent, mais ils
 * ne testent plus le jeu.
 */
export function bottomGrid(...bottomRows: string[]): string {
  const padded = bottomRows.map((row) => row.padEnd(GRID_COLS, '.').slice(0, GRID_COLS));
  const filler = Array.from({ length: GRID_ROWS - padded.length }, () => '.'.repeat(GRID_COLS));
  return [...filler, ...padded].join('\n');
}
