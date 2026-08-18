/**
 * Constantes de gameplay — SOURCE DE VERITE UNIQUE.
 *
 * Regle du depot : aucune valeur de gameplay en dur ailleurs que dans ce fichier.
 * Un playtest de calibration = editer ce fichier, rien d'autre.
 */

// --- Grille -----------------------------------------------------------------

export const GRID_COLS = 8;
export const GRID_ROWS = 14;

/** Longueur minimale d'un mot valide. [BALANCE] 2 trivialiserait le jeu. */
export const MIN_WORD_LENGTH = 3;

// --- File d'attente ---------------------------------------------------------

/** Nombre de lettres visibles en avance (anticipation lexicale). */
export const QUEUE_SIZE = 3;

// --- Chute ------------------------------------------------------------------

/** Millisecondes entre deux descentes d'un cran. [BALANCE] */
export const FALL_INTERVAL_MS = 750;

/** Intervalle de chute quand le joueur maintient la descente rapide. [BALANCE] */
export const SOFT_DROP_INTERVAL_MS = 60;

// --- Scoring ----------------------------------------------------------------

/** Score de base X, multiplie par le facteur de longueur. [BALANCE] */
export const SCORE_BASE = 100;

/**
 * Facteur multiplicatif par longueur de mot. Courbe volontairement agressive :
 * c'est le rempart contre le spam de mots courts, qui est le risque de design
 * numero 1 du concept (brief §8). [BALANCE] — ne pas adoucir sans playtest.
 *
 * INVARIANT A TENIR : la courbe doit etre **strictement sur-additive**, soit
 * `2 * m(n) < m(n+1)`. Autrement dit, deux mots de n lettres doivent toujours
 * rapporter strictement moins qu'un seul mot de n+1 lettres.
 *
 * La courbe du brief (1 / 2.5 / 5 / 9) violait cet invariant en un point :
 * 2 x 2.5 = 5, donc deux mots de 4 lettres valaient EXACTEMENT un mot de 5.
 * A parite de score, le joueur choisit toujours le coup le plus facile — le
 * spam redevenait optimal a cet endroit precis. 5 et 6+ sont donc remontes.
 * Le test `tests/scoring.test.ts` verrouille cet invariant.
 */
export const SCORE_LENGTH_MULTIPLIERS: Readonly<Record<number, number>> = {
  3: 1,
  4: 2.5,
  5: 6,
  6: 14,
  7: 30,
  8: 65,
};

/**
 * Applique au-dela de la plus grande cle. Sur une grille de 8 colonnes aucun
 * mot horizontal ne peut depasser 8 lettres, donc ce cas n'arrive pas en V0 —
 * il existe pour le jour ou la grille s'elargira ou ou le vertical s'activera.
 */
export const SCORE_LENGTH_MULTIPLIER_MAX = 65;

/**
 * Multiplicateur de chaine : +0.5 par maillon supplementaire dans la meme chute.
 * Chaine de profondeur 1 = x1, profondeur 2 = x1.5, profondeur 3 = x2... [BALANCE]
 */
export const CHAIN_MULTIPLIER_STEP = 0.5;

// --- Garbage / PvP ----------------------------------------------------------

/**
 * Score necessaire pour envoyer une ligne de garbage a l'adversaire. [BALANCE]
 * Calibre pour que 3 et 4 lettres n'envoient RIEN : le garbage est une
 * recompense de construction, pas un debit continu. Avec les valeurs actuelles :
 * 5 lettres -> 1 ligne, 6 lettres -> 3 lignes, 6 lettres en chaine x2 -> 4 (cap).
 */
export const GARBAGE_SCORE_PER_ROW = 400;

/** Plafond de garbage envoye par un seul clear, pour eviter les one-shots. [BALANCE] */
export const GARBAGE_MAX_ROWS_PER_CLEAR = 4;

/** Glyphes de bruit. Non alphabetiques : ils ne participent a aucun mot. */
export const GARBAGE_GLYPHS = ['¤', '§', '¬', '‡'] as const;

// --- Wildcard ---------------------------------------------------------------

/** Glyphe de la lettre joker. */
export const WILDCARD_GLYPH = '?';

/**
 * Nombre de tours consecutifs sans aucun mot formable avant que le generateur
 * ne lache un wildcard en secours (anti-plateau-mort). [BALANCE]
 *
 * Calibre sur mesure, pas a l'oeil (`npm run simulate` -> mode calibrate).
 * Sur 3141 poses simulees : seules 8.5% des poses permettent de completer un
 * mot immediatement, et la serie seche mediane dure 9 tours. Une valeur de 12
 * declenchait donc le joker sur ~25% des series : les 3 jokers etaient consommes
 * dans CHAQUE partie, ce qui en faisait une ressource banale au lieu d'un filet.
 * 30 correspond au p95 : le joker ne sort que sur une vraie panne.
 */
export const WILDCARD_DRY_SPELL_TURNS = 30;

/** Nombre maximum de wildcards distribues par partie. [BALANCE] */
export const WILDCARD_MAX_PER_GAME = 3;

// --- Distribution des lettres ----------------------------------------------

/**
 * Poids de tirage inspires du sac de Scrabble francais, mais retouches :
 * on gonfle les consonnes structurantes (S, T, R, N, L) et on ecrase les
 * lettres rares, parce qu'une grille de 8 colonnes pardonne beaucoup moins
 * qu'un chevalet de 7 lettres qu'on peut reorganiser. [BALANCE]
 */
export const LETTER_WEIGHTS: Readonly<Record<string, number>> = {
  E: 15, A: 9, I: 8, S: 8, N: 7, T: 7, R: 7, U: 6, L: 5, O: 5,
  D: 4, C: 3, M: 3, P: 3, G: 2, B: 2, V: 2, F: 2, H: 2, Q: 1,
  J: 1, X: 1, Y: 1, Z: 1, K: 1, W: 1,
};

// --- Fin de partie ----------------------------------------------------------

/**
 * Nombre de lignes du haut qui, une fois occupees, declenchent le topping out.
 * A 1, on meurt des qu'une piece se pose sur la ligne 0.
 */
export const TOPOUT_ROWS = 1;
