/**
 * Constantes de gameplay — SOURCE DE VERITE UNIQUE.
 *
 * Regle du depot : aucune valeur de gameplay en dur ailleurs que dans ce fichier.
 * Un playtest de calibration = editer ce fichier, rien d'autre.
 */

// --- Grille -----------------------------------------------------------------

export const GRID_COLS = 12;
export const GRID_ROWS = 18;

/**
 * Longueur minimale d'un mot valide. [BALANCE]
 * A 2, la densite de mots explose (voir README §4) : c'est un choix assume qui
 * transforme le jeu en course a la vitesse plutot qu'en jeu de construction.
 * La courbe de score compense en rendant les mots de 2 lettres presque gratuits.
 */
export const MIN_WORD_LENGTH = 2;

/**
 * Le plus long mot detectable : la plus grande dimension de la grille, puisque
 * les mots verticaux peuvent occuper une colonne entiere.
 */
export const MAX_WORD_LENGTH = Math.max(GRID_COLS, GRID_ROWS);

// --- Directions de lecture --------------------------------------------------

/**
 * Directions scannees. Chaque direction est aussi testee **a l'envers** : on ne
 * scanne donc que 4 vecteurs pour couvrir les 8 sens de lecture, ce qui evite
 * de compter deux fois le meme groupe de cellules.
 *
 * Diagonales activees (elles etaient marquees "jamais" dans le brief initial —
 * decision revue par l'utilisateur). Consequence a garder en tete : une lettre
 * posee appartient desormais a 4 axes au lieu d'1, donc la probabilite qu'elle
 * complete un mot est bien plus elevee. [BALANCE]
 */
export const WORD_DIRECTIONS: ReadonlyArray<{ name: string; dRow: number; dCol: number }> = [
  { name: 'E', dRow: 0, dCol: 1 },   // horizontal   (+ OUEST par lecture inverse)
  { name: 'S', dRow: 1, dCol: 0 },   // vertical bas (+ HAUT par lecture inverse)
  { name: 'SE', dRow: 1, dCol: 1 },  // diagonale bas-droite (+ haut-gauche)
  { name: 'NE', dRow: -1, dCol: 1 }, // diagonale haut-droite (+ bas-gauche)
];

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
 * spam redevenait optimal a cet endroit precis.
 *
 * Depuis l'ouverture aux mots de 2 lettres, cet invariant est la SEULE chose
 * qui empeche le jeu de se resumer a poser des "DE" et des "OU" : un mot de
 * 2 lettres vaut 0.4 X, soit moins de la moitie d'un mot de 3.
 * Le test `tests/scoring.test.ts` verrouille l'invariant sur toute la plage.
 */
export const SCORE_LENGTH_MULTIPLIERS: Readonly<Record<number, number>> = {
  2: 0.4,
  3: 1,
  4: 2.5,
  5: 6,
  6: 16,
  7: 39,
  8: 98,
  9: 244,
  10: 610,
};

/**
 * Plafond de la courbe. Au-dela de 10 lettres, le multiplicateur ne monte plus :
 * aligner 11 cellules exactes releve de l'accident, donc l'anti-spam n'a plus
 * d'objet — et une exponentielle non bornee produirait des scores illisibles.
 */
export const SCORE_LENGTH_MULTIPLIER_MAX = 610;

/** Derniere longueur sur laquelle l'invariant sur-additif est verifie. */
export const MAX_SCORED_LENGTH = 10;

/**
 * Multiplicateur de chaine : +0.5 par maillon supplementaire dans la meme chute.
 * Chaine de profondeur 1 = x1, profondeur 2 = x1.5, profondeur 3 = x2... [BALANCE]
 */
export const CHAIN_MULTIPLIER_STEP = 0.5;

// --- Garbage / PvP ----------------------------------------------------------

/**
 * Score necessaire pour envoyer une ligne de garbage a l'adversaire. [BALANCE]
 * Calibre pour que 2, 3 et 4 lettres n'envoient RIEN : le garbage reste une
 * recompense de construction, pas un debit continu. Avec les valeurs actuelles :
 * 5 lettres -> 1 ligne, 6 -> 2 lignes, 7 -> 6 (cap).
 */
export const GARBAGE_SCORE_PER_ROW = 600;

/**
 * Plafond de garbage envoye par un seul clear, pour eviter les one-shots.
 * Remonte a 6 avec l'agrandissement de la grille : sur 18 lignes, 4 lignes de
 * bruit ne se voyaient presque plus. [BALANCE]
 */
export const GARBAGE_MAX_ROWS_PER_CLEAR = 6;

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
