/**
 * Rendu ASCII en DOM.
 *
 * Une cellule = un <span>. La couleur distingue lettre joueur / bruit / joker /
 * lettre en chute, conformement au brief §6. Le rendu est un pur reflet de
 * l'etat : il ne decide de rien, il ne stocke rien.
 *
 * Exception limitee : `overrides` permet a l'appelant (main.ts) d'afficher,
 * pour un joueur donne, une grille et un surlignage differents de l'etat reel
 * le temps d'une animation de clear. C'est le seul etat "hors GameState" que
 * ce module accepte, et il reste un pur affichage — main.ts decide seul de la
 * sequence, render() ne fait qu'illustrer ce qu'on lui donne a un instant T.
 */
import type { Grid, GameState, PlayerId, PlayerState } from '../core/types.js';
import { isGarbage, isWildcard } from '../core/grid.js';

/** Ce qu'il faut montrer pour un joueur a la place de son etat "reel". */
export interface RenderOverride {
  grid: Grid;
  /**
   * Pendant une animation de clear, la lettre en chute reelle appartient deja
   * au futur (le prochain tour) : elle doit rester cachee tant qu'on montre le
   * passe (mot en train de disparaitre). D'ou un champ obligatoire, jamais
   * "value par defaut" implicite.
   */
  falling: PlayerState['falling'];
  /** Cellules a surligner, encodees "row,col". */
  matched?: ReadonlySet<string>;
  /** Texte transitoire affiche pendant le surlignage (ex: "CHAT +250"). */
  label?: string;
}

export type RenderOverrides = Partial<Record<PlayerId, RenderOverride>>;

function cellClass(char: string | null, isFalling: boolean, isMatched: boolean): string {
  if (isMatched) return 'cell cell--matched';
  if (isFalling) return 'cell cell--falling';
  if (char === null) return 'cell cell--empty';
  if (isGarbage(char)) return 'cell cell--garbage';
  if (isWildcard(char)) return 'cell cell--wildcard';
  return 'cell cell--letter';
}

function renderGrid(grid: Grid, falling: PlayerState['falling'], matched?: ReadonlySet<string>): string {
  const rows = grid.map((line, row) =>
    line
      .map((cell, col) => {
        const isFalling = falling !== null && falling.row === row && falling.col === col;
        const isMatched = matched?.has(`${row},${col}`) ?? false;
        const char = isFalling ? falling!.letter : cell;
        return `<span class="${cellClass(char, isFalling, isMatched)}">${char ?? '·'}</span>`;
      })
      .join(''),
  );
  return rows.map((line) => `<div class="grid-row">${line}</div>`).join('');
}

function renderPanel(player: PlayerState, label: string, matchLabel?: string): string {
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
      <div class="match-label">${matchLabel ?? '&nbsp;'}</div>
    </div>`;
}

export interface RenderTargets {
  root: HTMLElement;
}

export function render(
  targets: RenderTargets,
  state: GameState,
  you: PlayerId,
  overrides: RenderOverrides = {},
): void {
  const opponent = you === 'P0' ? 'P1' : 'P0';
  const me = state.players[you];
  const them = state.players[opponent];

  const banner =
    state.status === 'over'
      ? `<div class="banner">${state.winner === you ? 'VICTOIRE' : 'DÉFAITE'} — Entrée pour rejouer</div>`
      : '';

  const meOverride = overrides[you];
  const themOverride = overrides[opponent];

  targets.root.innerHTML = `
    ${banner}
    <div class="boards">
      <div class="board board--you">
        ${renderPanel(me, 'VOUS', meOverride?.label)}
        <div class="grid">${renderGrid(
          meOverride?.grid ?? me.grid,
          meOverride ? meOverride.falling : me.falling,
          meOverride?.matched,
        )}</div>
      </div>
      <div class="board board--opponent">
        ${renderPanel(them, 'ADVERSAIRE', themOverride?.label)}
        <div class="grid">${renderGrid(
          themOverride?.grid ?? them.grid,
          themOverride ? themOverride.falling : them.falling,
          themOverride?.matched,
        )}</div>
      </div>
    </div>
    <div class="help">
      ← → déplacer · ↓ descente rapide · Espace pose immédiate · Entrée rejouer<br />
      Mots de 2 lettres minimum, lus horizontalement, verticalement, en diagonale, et à l'envers.
    </div>`;
}
