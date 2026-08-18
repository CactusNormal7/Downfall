/**
 * Construction des sequences d'animation de clear a partir des evenements du
 * moteur.
 *
 * Le moteur reste muet et instantane (CLAUDE.md §3) : `resolveBoard()` calcule
 * tout un enchainement de clears en un seul appel synchrone. Ce module ne fait
 * que REJOUER dans le temps ce que les evenements decrivent deja —
 * `CHAIN_STEP.grid` (etat juste avant ce maillon, mot encore visible) et
 * `BOARD_SETTLED.grid` (etat juste apres, effets et gravite compris). Il ne
 * recalcule jamais de grille lui-meme : toute divergence avec le moteur
 * casserait la garantie que l'animation montre exactement ce qui s'est
 * reellement passe (voir tests/engine.test.ts, "fournit les snapshots...").
 */
import type { Grid, GameEvent, PlayerId } from '../core/types.js';
import type { RenderOverride } from './render.js';

export interface AnimationFrame {
  override: RenderOverride;
  durationMs: number;
}

/** Duree du surlignage d'un mot valide, avant qu'il ne disparaisse. [BALANCE] */
const MATCH_HIGHLIGHT_MS = 420;

/** Pause apres l'effacement, le temps que l'oeil enregistre le nouvel etat. [BALANCE] */
const MATCH_SETTLE_MS = 150;

/**
 * Reconstruit la sequence "surligner puis effacer" pour un joueur, a partir
 * des evenements produits par un seul `step()`. Vide si ce joueur n'a forme
 * aucun mot durant cette transition (cas normal : la plupart des poses ne
 * declenchent pas d'animation).
 */
export function buildMatchFrames(events: readonly GameEvent[], player: PlayerId): AnimationFrame[] {
  const frames: AnimationFrame[] = [];
  let stepGrid: Grid | null = null;
  let stepCells = new Set<string>();
  let stepLabels: string[] = [];

  for (const event of events) {
    switch (event.type) {
      case 'CHAIN_STEP':
        if (event.player !== player) break;
        // Nouveau maillon : on repart d'une ardoise vierge pour ce depth.
        stepGrid = event.grid;
        stepCells = new Set();
        stepLabels = [];
        break;

      case 'WORD_MATCHED':
        if (event.player !== player) break;
        for (const cell of event.cells) stepCells.add(`${cell.row},${cell.col}`);
        stepLabels.push(`${event.word} +${event.score}`);
        break;

      case 'BOARD_SETTLED':
        if (event.player !== player || !stepGrid) break;
        frames.push({
          override: { grid: stepGrid, falling: null, matched: stepCells, label: stepLabels.join(' · ') },
          durationMs: MATCH_HIGHLIGHT_MS,
        });
        frames.push({
          override: { grid: event.grid, falling: null },
          durationMs: MATCH_SETTLE_MS,
        });
        stepGrid = null;
        break;

      default:
        break;
    }
  }
  return frames;
}
