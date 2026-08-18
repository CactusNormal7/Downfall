import { describe, expect, it } from 'vitest';
import { chainMultiplier, garbageRowsFor, lengthMultiplier, scoreWord } from '../src/core/scoring.js';
import {
  GARBAGE_MAX_ROWS_PER_CLEAR,
  MAX_SCORED_LENGTH,
  MIN_WORD_LENGTH,
} from '../src/config.js';

describe('scoring', () => {
  it('applique une courbe croissante et non lineaire', () => {
    for (let length = MIN_WORD_LENGTH; length < MAX_SCORED_LENGTH; length += 1) {
      expect(lengthMultiplier(length + 1)).toBeGreaterThan(lengthMultiplier(length));
    }
  });

  it('rend le spam de mots courts strictement moins rentable (invariant)', () => {
    // LE test qui protege le concept : la courbe doit etre strictement
    // sur-additive. Deux mots de n lettres doivent toujours valoir moins
    // qu'un seul mot de n+1. Si ce test casse, le jeu degenere en spam.
    for (let length = MIN_WORD_LENGTH; length < MAX_SCORED_LENGTH; length += 1) {
      expect(2 * lengthMultiplier(length)).toBeLessThan(lengthMultiplier(length + 1));
    }
  });

  it('applique l invariant sur de vrais mots', () => {
    // Le mot de 2 lettres est le nouveau plancher : il doit rester derisoire.
    expect(scoreWord('OU', 1) * 2).toBeLessThan(scoreWord('AIE', 1));
    expect(scoreWord('AIE', 1) * 2).toBeLessThan(scoreWord('CHAT', 1));
    expect(scoreWord('CHAT', 1) * 2).toBeLessThan(scoreWord('CHATS', 1));
    expect(scoreWord('CHATS', 1) * 2).toBeLessThan(scoreWord('MAISON', 1));
  });

  it('ne bonifie pas une chaine de profondeur 1', () => {
    expect(chainMultiplier(1)).toBe(1);
    expect(chainMultiplier(2)).toBe(1.5);
    expect(chainMultiplier(3)).toBe(2);
  });

  it('cumule longueur et chaine', () => {
    expect(scoreWord('CHAT', 3)).toBe(scoreWord('CHAT', 1) * 2);
  });

  it("n'envoie aucun garbage pour un mot court", () => {
    // Jusqu'a 4 lettres on marque des points, mais on ne punit pas l'adversaire.
    expect(garbageRowsFor(scoreWord('OU', 1))).toBe(0);
    expect(garbageRowsFor(scoreWord('AIE', 1))).toBe(0);
    expect(garbageRowsFor(scoreWord('CHAT', 1))).toBe(0);
  });

  it('envoie du garbage pour un mot long', () => {
    expect(garbageRowsFor(scoreWord('MAISON', 1))).toBeGreaterThan(0);
  });

  it('plafonne le garbage envoye par un seul clear', () => {
    expect(garbageRowsFor(999999)).toBe(GARBAGE_MAX_ROWS_PER_CLEAR);
  });
});
