import { describe, expect, it } from 'vitest';
import {
  applyGravity,
  dropRow,
  gridFromAscii,
  gridToAscii,
  insertGarbageRows,
  isToppedOut,
} from '../src/core/grid.js';

describe('grid', () => {
  it('tasse les colonnes vers le bas', () => {
    const before = gridFromAscii(`
      A..
      ...
      B.C
    `);
    expect(gridToAscii(applyGravity(before))).toBe(['...', 'A..', 'B.C'].join('\n'));
  });

  it('trouve la case ou une lettre atterrit', () => {
    const grid = gridFromAscii(`
      ...
      ..X
      A.X
    `);
    expect(dropRow(grid, 0)).toBe(1);
    expect(dropRow(grid, 1)).toBe(2);
    expect(dropRow(grid, 2)).toBe(0);
  });

  it('rend -1 pour une colonne pleine', () => {
    expect(dropRow(gridFromAscii('X\nX'), 0)).toBe(-1);
  });

  it('pousse la grille vers le haut en inserant du garbage', () => {
    const grid = gridFromAscii(`
      ...
      ...
      ABC
    `);
    const result = insertGarbageRows(grid, 1, 42);
    const lines = gridToAscii(result.grid).split('\n');
    expect(lines[1]).toBe('ABC');
    expect(lines[2]).toMatch(/^[¤§¬‡]{3}$/);
  });

  it('detecte le topping out sur la ligne du haut', () => {
    expect(isToppedOut(gridFromAscii('...\n...'))).toBe(false);
    expect(isToppedOut(gridFromAscii('..X\n...'))).toBe(true);
  });
});
