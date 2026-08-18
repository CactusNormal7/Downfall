/**
 * Generation des lettres.
 *
 * Tirage pondere plutot que sac de Scrabble reel : un vrai sac s'epuise, ce qui
 * cree des fins de partie ou il ne reste que des consonnes. Ici la distribution
 * est stationnaire, donc calibrable a une seule table (LETTER_WEIGHTS).
 */
import { LETTER_WEIGHTS } from '../config.js';
import { nextRandom } from './rng.js';

const ENTRIES = Object.entries(LETTER_WEIGHTS);
const TOTAL_WEIGHT = ENTRIES.reduce((sum, [, weight]) => sum + weight, 0);

/** Tire une lettre. Rend aussi le nouvel etat du PRNG (le moteur reste pur). */
export function drawLetter(rngState: number): { letter: string; rngState: number } {
  const roll = nextRandom(rngState);
  let cursor = roll.value * TOTAL_WEIGHT;

  for (const [letter, weight] of ENTRIES) {
    cursor -= weight;
    if (cursor <= 0) return { letter, rngState: roll.state };
  }
  // Filet en cas d'erreur d'arrondi flottant sur la derniere entree.
  return { letter: ENTRIES[ENTRIES.length - 1]?.[0] ?? 'E', rngState: roll.state };
}

/** Remplit une file d'attente jusqu'a `size`. */
export function fillQueue(
  queue: readonly string[],
  size: number,
  rngState: number,
): { queue: string[]; rngState: number } {
  const next = [...queue];
  let state = rngState;
  while (next.length < size) {
    const draw = drawLetter(state);
    next.push(draw.letter);
    state = draw.rngState;
  }
  return { queue: next, rngState: state };
}
