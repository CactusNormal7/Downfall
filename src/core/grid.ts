/**
 * Manipulation de grille. Toutes les fonctions sont pures : elles rendent une
 * nouvelle grille, elles ne mutent jamais celle qu'on leur passe. C'est ce qui
 * permet a un serveur autoritaire de garder l'etat precedent pour arbitrer.
 */
import type { Cell, Grid } from './types.js';
import { GRID_COLS, GRID_ROWS, GARBAGE_GLYPHS, WILDCARD_GLYPH, TOPOUT_ROWS } from '../config.js';
import { nextInt } from './rng.js';

export function createGrid(rows = GRID_ROWS, cols = GRID_COLS): Grid {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null as Cell));
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

export function cellAt(grid: Grid, row: number, col: number): Cell {
  return grid[row]?.[col] ?? null;
}

export function isInside(grid: Grid, row: number, col: number): boolean {
  return row >= 0 && row < grid.length && col >= 0 && col < (grid[0]?.length ?? 0);
}

export function isFree(grid: Grid, row: number, col: number): boolean {
  return isInside(grid, row, col) && cellAt(grid, row, col) === null;
}

/** Un glyphe de bruit ne participe a aucun mot — c'est toute sa raison d'etre. */
export function isGarbage(cell: Cell): boolean {
  return cell !== null && (GARBAGE_GLYPHS as readonly string[]).includes(cell);
}

export function isWildcard(cell: Cell): boolean {
  return cell === WILDCARD_GLYPH;
}

/** Une cellule qui peut entrer dans un mot : lettre A-Z ou joker. */
export function isWordable(cell: Cell): boolean {
  return cell !== null && (isWildcard(cell) || /^[A-Z]$/.test(cell));
}

/** Ligne la plus basse libre dans une colonne, ou -1 si la colonne est pleine. */
export function dropRow(grid: Grid, col: number): number {
  for (let row = grid.length - 1; row >= 0; row -= 1) {
    if (cellAt(grid, row, col) === null) return row;
  }
  return -1;
}

export function setCell(grid: Grid, row: number, col: number, value: Cell): Grid {
  const next = cloneGrid(grid);
  const line = next[row];
  if (line) line[col] = value;
  return next;
}

export function clearCells(grid: Grid, cells: ReadonlyArray<{ row: number; col: number }>): Grid {
  const next = cloneGrid(grid);
  for (const { row, col } of cells) {
    const line = next[row];
    if (line) line[col] = null;
  }
  return next;
}

/**
 * Gravite : chaque colonne se tasse vers le bas. Appelee apres chaque clear,
 * c'est elle qui rend les chaines possibles — les lettres qui retombent peuvent
 * former un nouveau mot.
 */
export function applyGravity(grid: Grid): Grid {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const next = createGrid(rows, cols);

  for (let col = 0; col < cols; col += 1) {
    let writeRow = rows - 1;
    for (let row = rows - 1; row >= 0; row -= 1) {
      const cell = cellAt(grid, row, col);
      if (cell !== null) {
        const line = next[writeRow];
        if (line) line[col] = cell;
        writeRow -= 1;
      }
    }
  }
  return next;
}

/**
 * Insere N lignes de bruit par le bas, en poussant tout vers le haut.
 *
 * [NET] En vrai PvP c'est le serveur qui decide du contenu exact de ces lignes
 * et le pousse aux deux clients, sinon les grilles divergent. Ici on tire
 * localement a partir du RNG du joueur, ce qui reste deterministe et rejouable.
 */
export function insertGarbageRows(
  grid: Grid,
  rows: number,
  rngState: number,
): { grid: Grid; rngState: number } {
  const cols = grid[0]?.length ?? 0;
  let state = rngState;
  let next = cloneGrid(grid);

  for (let i = 0; i < rows; i += 1) {
    const line: Cell[] = [];
    for (let col = 0; col < cols; col += 1) {
      const roll = nextInt(state, GARBAGE_GLYPHS.length);
      state = roll.state;
      line.push(GARBAGE_GLYPHS[roll.value] ?? GARBAGE_GLYPHS[0]);
    }
    next.shift(); // la ligne du haut deborde et disparait
    next.push(line);
  }
  return { grid: next, rngState: state };
}

/** Topping out : les TOPOUT_ROWS premieres lignes sont occupees. */
export function isToppedOut(grid: Grid): boolean {
  for (let row = 0; row < TOPOUT_ROWS; row += 1) {
    const line = grid[row];
    if (!line) continue;
    if (line.some((cell) => cell !== null)) return true;
  }
  return false;
}

/** Rendu texte d'une grille — utilise par les tests et le debug console. */
export function gridToAscii(grid: Grid): string {
  return grid.map((row) => row.map((cell) => cell ?? '.').join('')).join('\n');
}

/** Parse une grille ecrite en ASCII litteral. Rend les tests lisibles a l'oeil. */
export function gridFromAscii(ascii: string): Grid {
  return ascii
    .trim()
    .split('\n')
    .map((line) => [...line.trim()].map((char) => (char === '.' ? null : char)));
}
