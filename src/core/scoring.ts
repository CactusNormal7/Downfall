/**
 * Scoring non lineaire.
 *
 * L'enjeu unique de ce module : rendre le spam de mots de 3 lettres
 * strictement moins rentable que la construction d'un mot long. Si un joueur
 * peut gagner en enchainant "AIE / OIE / RUE", le concept s'effondre.
 * C'est le risque de design n°1 du brief (§8) — d'ou la courbe agressive.
 */
import {
  SCORE_BASE,
  SCORE_LENGTH_MULTIPLIERS,
  SCORE_LENGTH_MULTIPLIER_MAX,
  CHAIN_MULTIPLIER_STEP,
  GARBAGE_SCORE_PER_ROW,
  GARBAGE_MAX_ROWS_PER_CLEAR,
} from '../config.js';

/** Facteur lie a la longueur seule. */
export function lengthMultiplier(length: number): number {
  return SCORE_LENGTH_MULTIPLIERS[length] ?? SCORE_LENGTH_MULTIPLIER_MAX;
}

/** Facteur lie a la profondeur de chaine. Profondeur 1 = pas de bonus. */
export function chainMultiplier(depth: number): number {
  return 1 + Math.max(0, depth - 1) * CHAIN_MULTIPLIER_STEP;
}

/** Score d'un mot efface a une profondeur de chaine donnee. */
export function scoreWord(word: string, chainDepth: number): number {
  return Math.round(SCORE_BASE * lengthMultiplier(word.length) * chainMultiplier(chainDepth));
}

/**
 * Conversion score -> lignes de garbage envoyees.
 * Volontairement a seuil : un mot de 3 lettres (100 pts) n'envoie rien du tout.
 * Le garbage est une recompense de construction, pas un debit continu.
 */
export function garbageRowsFor(score: number): number {
  return Math.min(GARBAGE_MAX_ROWS_PER_CLEAR, Math.floor(score / GARBAGE_SCORE_PER_ROW));
}
