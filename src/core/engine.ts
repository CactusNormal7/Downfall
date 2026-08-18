/**
 * Moteur de jeu. Pur, deterministe, sans I/O.
 *
 * Contrat : `step(state, action, dictionary) -> { state, events }`.
 * - Aucun acces au DOM, a Date.now(), a Math.random().
 * - Aucun log : le moteur **decrit** via des evenements, la couche au-dessus logge.
 * - Deux joueurs existent des la V0 : le garbage part reellement vers P1, il est
 *   juste route localement. [NET] Le jour du vrai PvP, ce meme code tourne sur
 *   le serveur autoritaire, et les deux clients ne font que rejouer ses evenements.
 */
import type {
  Action,
  GameEvent,
  GameState,
  PlayerId,
  PlayerState,
  StepResult,
} from './types.js';
import {
  applyGravity,
  cloneGrid,
  createGrid,
  dropRow,
  insertGarbageRows,
  isFree,
  isToppedOut,
  setCell,
} from './grid.js';
import { findWords, hasPlayableWord } from './words.js';
import { garbageRowsFor, scoreWord } from './scoring.js';
import { effectFor } from './effects.js';
import { fillQueue } from './bag.js';
import type { Dictionary } from '../dict/dictionary.js';
import {
  QUEUE_SIZE,
  WILDCARD_GLYPH,
  WILDCARD_DRY_SPELL_TURNS,
  WILDCARD_MAX_PER_GAME,
} from '../config.js';

/** L'adversaire d'un joueur. Trivial a 2 joueurs, isole ici pour le jour ou on passera a N. */
export function opponentOf(player: PlayerId): PlayerId {
  return player === 'P0' ? 'P1' : 'P0';
}

function createPlayer(id: PlayerId, seed: number): PlayerState {
  const filled = fillQueue([], QUEUE_SIZE, seed);
  return {
    id,
    grid: createGrid(),
    falling: null,
    queue: filled.queue,
    score: 0,
    rngState: filled.rngState,
    pendingGarbage: 0,
    drySpell: 0,
    wildcardsUsed: 0,
    wordsCleared: 0,
    bestChain: 0,
    alive: true,
  };
}

/**
 * Cree un match. Chaque joueur a **sa propre seed** (brief §5) : contrairement
 * a un versus a seed partagee, les deux grilles ne recoivent pas les memes lettres.
 */
export function createGame(seedP0: number, seedP1: number): GameState {
  return {
    players: { P0: createPlayer('P0', seedP0), P1: createPlayer('P1', seedP1) },
    tick: 0,
    winner: null,
    status: 'running',
  };
}

/** Copie superficielle d'un joueur dans l'etat. Le moteur ne mute jamais l'entree. */
function withPlayer(state: GameState, player: PlayerState): GameState {
  return { ...state, players: { ...state.players, [player.id]: player } };
}

/**
 * Fait apparaitre la prochaine lettre en haut de la grille.
 * C'est aussi ici que se declenche le filet anti-plateau-mort : si le joueur
 * n'a rien pu former depuis WILDCARD_DRY_SPELL_TURNS tours, on lache un joker.
 */
function spawnLetter(player: PlayerState, dictionary: Dictionary): {
  player: PlayerState;
  events: GameEvent[];
} {
  const events: GameEvent[] = [];
  const filled = fillQueue(player.queue, QUEUE_SIZE + 1, player.rngState);
  const [head, ...rest] = filled.queue;
  let letter = head ?? 'E';
  let state = filled.rngState;
  let { drySpell, wildcardsUsed } = player;

  // Anti-plateau-mort : le generateur observe si un mot etait seulement possible.
  if (hasPlayableWord(player.grid, letter, dictionary)) {
    drySpell = 0;
  } else {
    drySpell += 1;
  }

  if (drySpell >= WILDCARD_DRY_SPELL_TURNS && wildcardsUsed < WILDCARD_MAX_PER_GAME) {
    letter = WILDCARD_GLYPH;
    wildcardsUsed += 1;
    drySpell = 0;
    events.push({ type: 'WILDCARD_GRANTED', player: player.id, drySpell: player.drySpell });
  }

  const spawnCol = Math.floor((player.grid[0]?.length ?? 1) / 2);
  const next: PlayerState = {
    ...player,
    falling: { letter, row: 0, col: spawnCol },
    queue: rest,
    rngState: state,
    drySpell,
    wildcardsUsed,
  };

  events.push({ type: 'LETTER_SPAWNED', player: player.id, letter, queue: [...rest] });
  return { player: next, events };
}

/**
 * Resolution complete apres qu'une lettre s'est posee : mots, effets, gravite,
 * puis rebouclage tant que la gravite refait apparaitre des mots (= la chaine).
 */
function resolveBoard(
  player: PlayerState,
  dictionary: Dictionary,
): { player: PlayerState; events: GameEvent[]; garbageToSend: number } {
  const events: GameEvent[] = [];
  let grid = player.grid;
  let score = player.score;
  let wordsCleared = player.wordsCleared;
  let bestChain = player.bestChain;
  let garbageToSend = 0;
  let depth = 0;

  for (;;) {
    const matches = findWords(grid, dictionary);
    if (matches.length === 0) break;

    depth += 1;
    events.push({
      type: 'CHAIN_STEP',
      player: player.id,
      depth,
      multiplier: 1 + Math.max(0, depth - 1) * 0.5,
      // Snapshot AVANT tout effacement de ce depth : les mots trouves y sont
      // encore visibles. C'est la base que l'UI surligne avant de les faire
      // disparaitre — voir le commentaire du champ dans core/types.ts.
      grid: cloneGrid(grid),
    });

    for (const match of matches) {
      const gained = scoreWord(match.word, depth);
      score += gained;
      wordsCleared += 1;

      events.push({
        type: 'WORD_MATCHED',
        player: player.id,
        word: match.word,
        row: match.row,
        fromCol: match.fromCol,
        toCol: match.toCol,
        cells: match.cells,
        score: gained,
        chainDepth: depth,
      });

      // L'effet s'applique AVANT l'effacement du mot, pour qu'il puisse lire
      // la grille telle que le joueur la voyait au moment du match.
      const effect = effectFor(match.word);
      if (effect) {
        const outcome = effect.handler({ grid, match });
        grid = outcome.grid;
        garbageToSend += outcome.bonusGarbage;
        events.push({
          type: 'EFFECT_TRIGGERED',
          player: player.id,
          word: match.word,
          effect: effect.name,
          cellsDestroyed: outcome.cellsDestroyed,
        });
      }

      garbageToSend += garbageRowsFor(gained);

      // Effacement du mot lui-meme.
      for (const cell of match.cells) {
        const line = grid[cell.row];
        if (line) line[cell.col] = null;
      }
      grid = grid.map((line) => [...line]);
    }

    // C'est cette gravite qui peut faire naitre le maillon suivant de la chaine.
    grid = applyGravity(grid);

    // Snapshot APRES effacement + effets + gravite de ce depth. Avec le
    // CHAIN_STEP ci-dessus, l'UI a exactement les deux bornes "avant / apres"
    // necessaires pour animer ce maillon sans reimplementer resolveBoard.
    events.push({ type: 'BOARD_SETTLED', player: player.id, chainDepth: depth, grid: cloneGrid(grid) });
  }

  if (depth > bestChain) bestChain = depth;

  return {
    player: { ...player, grid, score, wordsCleared, bestChain },
    events,
    garbageToSend,
  };
}

/** Verrouille la lettre en chute et enchaine la resolution. */
function lockLetter(
  state: GameState,
  playerId: PlayerId,
  dictionary: Dictionary,
): StepResult {
  const player = state.players[playerId];
  const falling = player.falling;
  if (!falling) return { state, events: [] };

  const events: GameEvent[] = [];
  let locked: PlayerState = {
    ...player,
    grid: setCell(player.grid, falling.row, falling.col, falling.letter),
    falling: null,
  };
  events.push({
    type: 'LETTER_LOCKED',
    player: playerId,
    letter: falling.letter,
    row: falling.row,
    col: falling.col,
  });

  const resolved = resolveBoard(locked, dictionary);
  locked = resolved.player;
  events.push(...resolved.events);

  let next = withPlayer(state, locked);

  // [NET] Point d'insertion reseau majeur. En vrai PvP, on n'applique PAS le
  // garbage soi-meme : on emet un message vers le serveur autoritaire, qui
  // arbitre les annulations mutuelles (deux joueurs qui envoient en meme temps)
  // et pousse le resultat aux deux clients.
  // Contrat attendu : { type: 'GARBAGE_SEND', from, to, rows, tick }
  if (resolved.garbageToSend > 0) {
    const target = opponentOf(playerId);
    const lastWord = resolved.events.find((event) => event.type === 'WORD_MATCHED');
    events.push({
      type: 'GARBAGE_SENT',
      from: playerId,
      to: target,
      rows: resolved.garbageToSend,
      word: lastWord && lastWord.type === 'WORD_MATCHED' ? lastWord.word : '',
    });
    next = withPlayer(next, {
      ...next.players[target],
      pendingGarbage: next.players[target].pendingGarbage + resolved.garbageToSend,
    });
  }

  // Le garbage en attente tombe entre deux pieces, pas au milieu d'une chute.
  const withGarbage = flushGarbage(next, playerId);
  next = withGarbage.state;
  events.push(...withGarbage.events);

  if (isToppedOut(next.players[playerId].grid)) {
    events.push({ type: 'TOPOUT', player: playerId });
    next = withPlayer(next, { ...next.players[playerId], alive: false });
    next = { ...next, status: 'over', winner: opponentOf(playerId) };
    events.push({ type: 'GAME_OVER', winner: opponentOf(playerId) });
    return { state: next, events };
  }

  const spawned = spawnLetter(next.players[playerId], dictionary);
  next = withPlayer(next, spawned.player);
  events.push(...spawned.events);

  return { state: next, events };
}

/** Applique le garbage en attente d'un joueur. */
function flushGarbage(state: GameState, playerId: PlayerId): StepResult {
  const player = state.players[playerId];
  if (player.pendingGarbage <= 0) return { state, events: [] };

  const inserted = insertGarbageRows(player.grid, player.pendingGarbage, player.rngState);
  const events: GameEvent[] = [
    { type: 'GARBAGE_APPLIED', player: playerId, rows: player.pendingGarbage },
  ];

  return {
    state: withPlayer(state, {
      ...player,
      grid: inserted.grid,
      rngState: inserted.rngState,
      pendingGarbage: 0,
    }),
    events,
  };
}

/**
 * Transition unique du moteur. Toute la V0 passe par ici.
 * [NET] Cote serveur, cette fonction est appelee avec l'action recue du client,
 * apres validation — le client n'est jamais cru sur parole.
 */
export function step(state: GameState, action: Action, dictionary: Dictionary): StepResult {
  if (state.status === 'over') return { state, events: [] };

  const playerId = action.player;
  const player = state.players[playerId];
  if (!player.alive) return { state, events: [] };

  switch (action.type) {
    case 'MOVE_LEFT':
    case 'MOVE_RIGHT': {
      if (!player.falling) return { state, events: [] };
      const delta = action.type === 'MOVE_LEFT' ? -1 : 1;
      const col = player.falling.col + delta;
      if (!isFree(player.grid, player.falling.row, col)) return { state, events: [] };
      return {
        state: withPlayer(state, { ...player, falling: { ...player.falling, col } }),
        events: [],
      };
    }

    case 'TICK':
    case 'SOFT_DROP': {
      // Pas de lettre en jeu : on en fait apparaitre une (demarrage de partie).
      if (!player.falling) {
        const spawned = spawnLetter(player, dictionary);
        return {
          state: { ...withPlayer(state, spawned.player), tick: state.tick + 1 },
          events: spawned.events,
        };
      }
      const below = player.falling.row + 1;
      if (isFree(player.grid, below, player.falling.col)) {
        return {
          state: {
            ...withPlayer(state, { ...player, falling: { ...player.falling, row: below } }),
            tick: state.tick + 1,
          },
          events: [],
        };
      }
      const locked = lockLetter(state, playerId, dictionary);
      return { state: { ...locked.state, tick: state.tick + 1 }, events: locked.events };
    }

    case 'HARD_DROP': {
      if (!player.falling) return { state, events: [] };
      const landing = dropRow(player.grid, player.falling.col);
      if (landing < 0) {
        // Colonne pleine : la lettre reste ou elle est et se verrouille.
        return lockLetter(state, playerId, dictionary);
      }
      const dropped = withPlayer(state, {
        ...player,
        falling: { ...player.falling, row: landing },
      });
      return lockLetter(dropped, playerId, dictionary);
    }

    case 'RECEIVE_GARBAGE': {
      // [NET] En vrai PvP cette action arrive du serveur, jamais du client local.
      return {
        state: withPlayer(state, {
          ...player,
          pendingGarbage: player.pendingGarbage + action.rows,
        }),
        events: [],
      };
    }

    default:
      return { state, events: [] };
  }
}
