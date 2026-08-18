/**
 * Detection de mots sur la grille.
 *
 * V0 : horizontal uniquement (brief §4.2, pour la lisibilite).
 * [V2] Vertical a activer si le horizontal seul manque de profondeur — la
 * fonction `scanLine` est deja generique, il suffira de lui passer les colonnes
 * transposees et de mapper les coordonnees en retour.
 * Diagonales : jamais.
 */
import type { Grid } from './types.js';
import { isWordable, isWildcard, cellAt, dropRow } from './grid.js';
import { MIN_WORD_LENGTH } from '../config.js';
import type { Dictionary } from '../dict/dictionary.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface WordMatch {
  /** Le mot reellement forme (joker deja resolu en lettre). */
  word: string;
  row: number;
  fromCol: number;
  toCol: number;
  cells: Array<{ row: number; col: number }>;
}

/**
 * Resout les jokers d'un segment. Sans joker, c'est un simple lookup.
 * Avec joker, on teste les 26 substitutions — c'est borne et rare
 * (WILDCARD_MAX_PER_GAME), donc acceptable dans une boucle temps reel.
 */
function resolveSegment(segment: string, dictionary: Dictionary): string | null {
  const wildcards = [...segment].filter((char) => char === '?').length;

  if (wildcards === 0) {
    return dictionary.has(segment) ? segment : null;
  }
  if (wildcards > 2) return null; // explosion combinatoire, on refuse

  const slot = segment.indexOf('?');
  for (const letter of ALPHABET) {
    const candidate = segment.slice(0, slot) + letter + segment.slice(slot + 1);
    const resolved = resolveSegment(candidate, dictionary);
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Cherche les mots dans une suite de cellules contigues.
 * Strategie : on privilegie les mots les plus longs, et on refuse les
 * chevauchements — sinon "CHATS" rapporterait aussi "CHAT" et "HAT", ce qui
 * casserait completement la courbe de score anti-spam.
 */
function scanLine(
  cells: ReadonlyArray<{ char: string; row: number; col: number }>,
  dictionary: Dictionary,
): WordMatch[] {
  const candidates: WordMatch[] = [];
  const text = cells.map((cell) => cell.char).join('');

  for (let start = 0; start < text.length; start += 1) {
    for (let end = text.length; end - start >= MIN_WORD_LENGTH; end -= 1) {
      const segment = text.slice(start, end);
      const resolved = resolveSegment(segment, dictionary);
      if (!resolved) continue;

      const slice = cells.slice(start, end);
      const first = slice[0];
      const last = slice[slice.length - 1];
      if (!first || !last) continue;

      candidates.push({
        word: resolved,
        row: first.row,
        fromCol: first.col,
        toCol: last.col,
        cells: slice.map((cell) => ({ row: cell.row, col: cell.col })),
      });
    }
  }

  // Le plus long gagne ; a longueur egale, le plus a gauche.
  candidates.sort((a, b) => b.word.length - a.word.length || a.fromCol - b.fromCol);

  const taken = new Set<string>();
  const kept: WordMatch[] = [];
  for (const candidate of candidates) {
    const key = (cell: { row: number; col: number }) => `${cell.row},${cell.col}`;
    if (candidate.cells.some((cell) => taken.has(key(cell)))) continue;
    for (const cell of candidate.cells) taken.add(key(cell));
    kept.push(candidate);
  }
  return kept;
}

/** Tous les mots presents sur la grille. Rend [] si la grille est inerte. */
export function findWords(grid: Grid, dictionary: Dictionary): WordMatch[] {
  const matches: WordMatch[] = [];
  const cols = grid[0]?.length ?? 0;

  for (let row = 0; row < grid.length; row += 1) {
    // Un segment s'arrete des qu'on croise du vide ou du bruit : le garbage
    // coupe litteralement les mots en deux, c'est son pouvoir de nuisance.
    let run: Array<{ char: string; row: number; col: number }> = [];

    const flush = () => {
      if (run.length >= MIN_WORD_LENGTH) matches.push(...scanLine(run, dictionary));
      run = [];
    };

    for (let col = 0; col < cols; col += 1) {
      const cell = cellAt(grid, row, col);
      if (isWordable(cell)) {
        run.push({ char: isWildcard(cell) ? '?' : (cell as string), row, col });
      } else {
        flush();
      }
    }
    flush();
  }
  return matches;
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
    if (findWords(probe, dictionary).length > 0) return true;
  }
  return false;
}
