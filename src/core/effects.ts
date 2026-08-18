/**
 * Mots a effet : certains mots declenchent une action liee a leur sens.
 *
 * Regle d'architecture : c'est une **table de donnees**, jamais une cascade de
 * `if` dans le moteur. Ajouter un effet = ajouter une ligne ici. Le moteur ne
 * connait que le contrat `EffectHandler`.
 *
 * V0 : trois effets pour prouver le concept et valider qu'ils sont lisibles a
 * l'ecran. [V2] elargir la table (GEL, MUR, VOL, ECHO...) une fois le feel valide.
 */
import type { Grid } from './types.js';
import { cellAt, clearCells } from './grid.js';
import type { WordMatch } from './words.js';

export interface EffectContext {
  grid: Grid;
  match: WordMatch;
}

export interface EffectOutcome {
  grid: Grid;
  /** Nombre de cellules detruites en plus du mot lui-meme. */
  cellsDestroyed: number;
  /** Lignes de garbage envoyees en bonus a l'adversaire. */
  bonusGarbage: number;
}

export type EffectHandler = (context: EffectContext) => EffectOutcome;

/** Detruit un rectangle centre sur le mot, garbage compris. */
function explode(radius: number): EffectHandler {
  return ({ grid, match }) => {
    const victims: Array<{ row: number; col: number }> = [];
    for (let row = match.row - radius; row <= match.row + radius; row += 1) {
      for (let col = match.fromCol - radius; col <= match.toCol + radius; col += 1) {
        if (cellAt(grid, row, col) === null) continue;
        // Le mot lui-meme est efface par le moteur, on ne le compte pas ici.
        const insideWord = row === match.row && col >= match.fromCol && col <= match.toCol;
        if (insideWord) continue;
        victims.push({ row, col });
      }
    }
    return { grid: clearCells(grid, victims), cellsDestroyed: victims.length, bonusGarbage: 0 };
  };
}

/** Nettoie toute la colonne sous et au-dessus du mot. */
const drill: EffectHandler = ({ grid, match }) => {
  const victims: Array<{ row: number; col: number }> = [];
  const col = Math.floor((match.fromCol + match.toCol) / 2);
  for (let row = 0; row < grid.length; row += 1) {
    if (row === match.row) continue;
    if (cellAt(grid, row, col) === null) continue;
    victims.push({ row, col });
  }
  return { grid: clearCells(grid, victims), cellsDestroyed: victims.length, bonusGarbage: 0 };
};

/** N'agit pas sur sa propre grille : envoie du bruit chez l'adversaire. */
function assault(rows: number): EffectHandler {
  return ({ grid }) => ({ grid, cellsDestroyed: 0, bonusGarbage: rows });
}

/**
 * Table des mots a effet. Cle = mot normalise (majuscules, sans accent).
 * [BALANCE] Ces mots deviennent des cibles prioritaires pour le joueur : leur
 * puissance doit rester en dessous d'un mot de 6 lettres bien construit.
 */
export const WORD_EFFECTS: Readonly<Record<string, { name: string; handler: EffectHandler }>> = {
  BOOM: { name: 'explosion', handler: explode(1) },
  BOMBE: { name: 'explosion', handler: explode(2) },
  FORER: { name: 'forage', handler: drill },
  // [NET] `assault` produit du garbage hors scoring : en vrai PvP ce bonus doit
  // passer par le meme message GARBAGE_SEND que le reste, sinon les deux clients
  // ne comptent pas le meme nombre de lignes et la partie desynchronise.
  ORAGE: { name: 'assaut', handler: assault(2) },
};

export function effectFor(word: string): { name: string; handler: EffectHandler } | null {
  return WORD_EFFECTS[word] ?? null;
}
