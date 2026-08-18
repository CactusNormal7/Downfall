/**
 * Genere le dictionnaire de jeu a partir de `an-array-of-french-words`
 * (liste derivee de Dicollecte, licence MIT).
 *
 * Le jeu n'a pas besoin des 336k formes flechies : la grille fait 8 colonnes,
 * donc aucun mot de plus de 8 lettres ne peut jamais etre forme horizontalement.
 * On filtre agressivement pour garder un asset leger a charger.
 *
 * Sortie : src/dict/words-fr.txt (un mot par ligne, majuscules, sans accent).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { MIN_WORD_LENGTH, GRID_COLS } from '../src/config.js';
import { normalizeWord } from '../src/dict/normalize.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, '../node_modules/an-array-of-french-words/index.json');
const OUTPUT = resolve(HERE, '../src/dict/words-fr.txt');

const raw = JSON.parse(readFileSync(SOURCE, 'utf8')) as string[];

const kept = new Set<string>();
let rejectedLength = 0;
let rejectedCharset = 0;

for (const entry of raw) {
  const word = normalizeWord(entry);

  // Un mot plus long que la grille est injouable : il ne rentre pas.
  if (word.length < MIN_WORD_LENGTH || word.length > GRID_COLS) {
    rejectedLength += 1;
    continue;
  }
  // Rejette apostrophes, traits d'union, chiffres, lettres non normalisables.
  if (!/^[A-Z]+$/.test(word)) {
    rejectedCharset += 1;
    continue;
  }
  kept.add(word);
}

const sorted = [...kept].sort();
writeFileSync(OUTPUT, sorted.join('\n') + '\n', 'utf8');

const byLength = new Map<number, number>();
for (const word of sorted) byLength.set(word.length, (byLength.get(word.length) ?? 0) + 1);

console.log(`[LEXA][DICT] BUILD source=${raw.length} kept=${sorted.length}`);
console.log(`[LEXA][DICT] REJECT length=${rejectedLength} charset=${rejectedCharset}`);
for (const len of [...byLength.keys()].sort((a, b) => a - b)) {
  console.log(`[LEXA][DICT] LENGTH len=${len} count=${byLength.get(len)}`);
}
