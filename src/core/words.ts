/**
 * Detection de mots sur la grille.
 *
 * Les 8 sens de lecture sont actifs : horizontal, vertical, les 4 diagonales,
 * et chacun dans les deux sens. On ne scanne pourtant que 4 vecteurs
 * (WORD_DIRECTIONS) : chaque segment est teste tel quel ET a l'envers. Scanner
 * les 8 vecteurs reviendrait a examiner deux fois exactement les memes groupes
 * de cellules, avec le risque de compter un mot en double.
 */
import type { Grid } from './types.js';
import { isWordable, isWildcard, cellAt, dropRow } from './grid.js';
import { MIN_WORD_LENGTH, WORD_DIRECTIONS } from '../config.js';
import type { Dictionary } from '../dict/dictionary.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Nombre maximum de jokers tolere dans un segment (explosion combinatoire). */
const MAX_WILDCARDS_PER_SEGMENT = 2;

/** Encode (row, col) en un entier unique. Doit depasser toute largeur de grille. */
const CELL_KEY_STRIDE = 1024;

export interface WordMatch {
  /** Le mot reellement forme, dans son sens de lecture (joker deja resolu). */
  word: string;
  /** Nom du vecteur scanne (E, S, SE, NE). */
  direction: string;
  /** true si le mot se lit a l'envers du vecteur. */
  reversed: boolean;
  /** Coordonnees de depart du mot, dans son sens de lecture. */
  row: number;
  col: number;
  /** Conservees pour l'affichage et les effets : bornes sur l'axe scanne. */
  fromCol: number;
  toCol: number;
  cells: Array<{ row: number; col: number }>;
}

interface ScanCell {
  char: string;
  row: number;
  col: number;
}

/**
 * Resout les jokers d'un segment. Sans joker, c'est un simple lookup O(1).
 * Avec joker, on teste les substitutions — borne a 2 jokers pour que le cout
 * reste 26^2 dans le pire cas, ce qui est negligeable et surtout tres rare.
 */
function resolveSegment(segment: string, dictionary: Dictionary): string | null {
  const slot = segment.indexOf('?');
  if (slot === -1) return dictionary.has(segment) ? segment : null;

  const wildcards = [...segment].filter((char) => char === '?').length;
  if (wildcards > MAX_WILDCARDS_PER_SEGMENT) return null;

  for (const letter of ALPHABET) {
    const candidate = segment.slice(0, slot) + letter + segment.slice(slot + 1);
    const resolved = resolveSegment(candidate, dictionary);
    if (resolved) return resolved;
  }
  return null;
}

/** Teste un segment dans les deux sens de lecture. */
function resolveBothWays(
  segment: string,
  dictionary: Dictionary,
): { word: string; reversed: boolean } | null {
  const forward = resolveSegment(segment, dictionary);
  if (forward) return { word: forward, reversed: false };

  const backward = resolveSegment([...segment].reverse().join(''), dictionary);
  if (backward) return { word: backward, reversed: true };

  return null;
}

/** Produit tous les mots contenus dans une suite de cellules contigues. */
function scanRun(run: ScanCell[], direction: string, dictionary: Dictionary): WordMatch[] {
  if (run.length < MIN_WORD_LENGTH) return [];

  const found: WordMatch[] = [];
  const text = run.map((cell) => cell.char).join('');

  for (let start = 0; start < text.length; start += 1) {
    for (let end = text.length; end - start >= MIN_WORD_LENGTH; end -= 1) {
      const resolved = resolveBothWays(text.slice(start, end), dictionary);
      if (!resolved) continue;

      const slice = run.slice(start, end);
      const cells = resolved.reversed ? [...slice].reverse() : slice;
      const head = cells[0];
      if (!head) continue;

      const cols = slice.map((cell) => cell.col);
      found.push({
        word: resolved.word,
        direction,
        reversed: resolved.reversed,
        row: head.row,
        col: head.col,
        fromCol: Math.min(...cols),
        toCol: Math.max(...cols),
        cells: cells.map((cell) => ({ row: cell.row, col: cell.col })),
      });
    }
  }
  return found;
}

/**
 * Arbitrage global entre candidats.
 *
 * Le plus long gagne, et un mot ne peut pas reutiliser une cellule deja prise.
 * Sans cette regle, CHATS rapporterait aussi CHAT, HAT et AT — et depuis
 * l'ouverture aux diagonales, la meme cellule appartient a 4 axes, donc un
 * unique placement pourrait etre facture une dizaine de fois. C'est ce qui
 * rendrait la courbe de score anti-spam totalement contournable.
 */
function resolveOverlaps(candidates: WordMatch[]): WordMatch[] {
  candidates.sort(
    (a, b) => b.word.length - a.word.length || a.row - b.row || a.col - b.col,
  );

  const taken = new Set<number>();
  const kept: WordMatch[] = [];

  for (const candidate of candidates) {
    // Cle entiere plutot que chaine : ce tri tourne a chaque verrouillage.
    const keys = candidate.cells.map((cell) => cell.row * CELL_KEY_STRIDE + cell.col);
    if (keys.some((key) => taken.has(key))) continue;
    for (const key of keys) taken.add(key);
    kept.push(candidate);
  }
  return kept;
}

/** Extrait la suite de cellules formant un mot potentiel a partir d'un depart. */
function collectRun(
  grid: Grid,
  startRow: number,
  startCol: number,
  dRow: number,
  dCol: number,
): ScanCell[] {
  const run: ScanCell[] = [];
  let row = startRow;
  let col = startCol;

  while (true) {
    const cell = cellAt(grid, row, col);
    // Le vide et le bruit coupent le segment : c'est tout le pouvoir de nuisance
    // du garbage, et il vaut maintenant sur les 4 axes.
    if (!isWordable(cell)) break;
    run.push({ char: isWildcard(cell) ? '?' : (cell as string), row, col });
    row += dRow;
    col += dCol;
  }
  return run;
}

/** Tous les mots presents sur la grille, tous axes et tous sens confondus. */
export function findWords(grid: Grid, dictionary: Dictionary): WordMatch[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const candidates: WordMatch[] = [];

  for (const { name, dRow, dCol } of WORD_DIRECTIONS) {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (!isWordable(cellAt(grid, row, col))) continue;
        // On ne demarre un segment que sur sa premiere cellule, sinon on
        // rescannerait les memes suites decalees d'un cran a chaque iteration.
        if (isWordable(cellAt(grid, row - dRow, col - dCol))) continue;
        candidates.push(...scanRun(collectRun(grid, row, col, dRow, dCol), name, dictionary));
      }
    }
  }
  return resolveOverlaps(candidates);
}

/**
 * Mots passant par une cellule precise.
 *
 * Version ciblee de `findWords`, indispensable pour les performances : le bot
 * et le detecteur de plateau mort testent une pose par colonne a chaque tour.
 * Un scan complet a chaque essai coutait, sur une grille 12x18 avec 4 axes,
 * une vingtaine de milliers de lookups pour rien — seuls les mots traversant
 * la cellule posee peuvent avoir change.
 */
export function findWordsThrough(
  grid: Grid,
  row: number,
  col: number,
  dictionary: Dictionary,
): WordMatch[] {
  if (!isWordable(cellAt(grid, row, col))) return [];

  const candidates: WordMatch[] = [];

  for (const { name, dRow, dCol } of WORD_DIRECTIONS) {
    // On remonte jusqu'au debut du segment qui contient la cellule.
    let startRow = row;
    let startCol = col;
    while (isWordable(cellAt(grid, startRow - dRow, startCol - dCol))) {
      startRow -= dRow;
      startCol -= dCol;
    }
    const run = collectRun(grid, startRow, startCol, dRow, dCol);
    const touching = scanRun(run, name, dictionary).filter((match) =>
      match.cells.some((cell) => cell.row === row && cell.col === col),
    );
    candidates.push(...touching);
  }
  return resolveOverlaps(candidates);
}

/**
 * Existe-t-il au moins un mot formable en posant `letter` quelque part ?
 * Sert au detecteur de plateau mort qui declenche le wildcard de secours.
 */
export function hasPlayableWord(grid: Grid, letter: string, dictionary: Dictionary): boolean {
  const cols = grid[0]?.length ?? 0;

  for (let col = 0; col < cols; col += 1) {
    // Seule la case atteignable compte : la lettre tombe, elle ne se pose pas
    // en l'air. C'est dropRow qui dit ou elle atterrira reellement.
    const row = dropRow(grid, col);
    if (row < 0) continue;

    const probe = grid.map((line) => [...line]);
    const target = probe[row];
    if (!target) continue;
    target[col] = letter;
    if (findWordsThrough(probe, row, col, dictionary).length > 0) return true;
  }
  return false;
}
