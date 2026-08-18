/**
 * Rendu ASCII en DOM.
 *
 * Une cellule = un <span>. La couleur distingue lettre joueur / bruit / joker /
 * lettre en chute, conformement au brief §6. Le rendu est un pur reflet de
 * l'etat : il ne decide de rien, il ne stocke rien.
 */
import type { GameState, PlayerId, PlayerState } from '../core/types.js';
import { isGarbage, isWildcard } from '../core/grid.js';

function cellClass(char: string | null, isFalling: boolean): string {
  if (isFalling) return 'cell cell--falling';
  if (char === null) return 'cell cell--empty';
  if (isGarbage(char)) return 'cell cell--garbage';
  if (isWildcard(char)) return 'cell cell--wildcard';
  return 'cell cell--letter';
}

function renderGrid(player: PlayerState): string {
  const falling = player.falling;
  const rows = player.grid.map((line, row) =>
    line
      .map((cell, col) => {
        const isFalling = falling !== null && falling.row === row && falling.col === col;
        const char = isFalling ? falling.letter : cell;
        return `<span class="${cellClass(char, isFalling)}">${char ?? '·'}</span>`;
      })
      .join(''),
  );
  return rows.map((line) => `<div class="grid-row">${line}</div>`).join('');
}

function renderPanel(player: PlayerState, label: string): string {
  const queue = player.queue.map((letter) => `<span class="queue-letter">${letter}</span>`).join('');
  const pending = player.pendingGarbage > 0 ? `<div class="warn">⚠ ${player.pendingGarbage} ligne(s) entrante(s)</div>` : '';
  return `
    <div class="panel">
      <div class="panel-title">${label}</div>
      <div class="stat"><span>Score</span><b>${player.score}</b></div>
      <div class="stat"><span>Mots</span><b>${player.wordsCleared}</b></div>
      <div class="stat"><span>Chaîne max</span><b>${player.bestChain}</b></div>
      <div class="stat"><span>Suivantes</span><span class="queue">${queue}</span></div>
      ${pending}
    </div>`;
}

export interface RenderTargets {
  root: HTMLElement;
}

export function render(targets: RenderTargets, state: GameState, you: PlayerId): void {
  const opponent = you === 'P0' ? 'P1' : 'P0';
  const me = state.players[you];
  const them = state.players[opponent];

  const banner =
    state.status === 'over'
      ? `<div class="banner">${state.winner === you ? 'VICTOIRE' : 'DÉFAITE'} — Entrée pour rejouer</div>`
      : '';

  targets.root.innerHTML = `
    ${banner}
    <div class="boards">
      <div class="board">
        ${renderPanel(me, 'VOUS')}
        <div class="grid">${renderGrid(me)}</div>
      </div>
      <div class="board board--opponent">
        ${renderPanel(them, 'ADVERSAIRE')}
        <div class="grid">${renderGrid(them)}</div>
      </div>
    </div>
    <div class="help">
      ← → déplacer · ↓ descente rapide · Espace pose immédiate · Entrée rejouer
    </div>`;
}
