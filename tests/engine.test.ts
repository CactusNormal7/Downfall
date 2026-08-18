import { describe, expect, it } from 'vitest';
import { createGame, step, opponentOf } from '../src/core/engine.js';
import type { Action, GameEvent, GameState } from '../src/core/types.js';
import { gridFromAscii, gridToAscii } from '../src/core/grid.js';
import { GRID_COLS, GRID_ROWS, QUEUE_SIZE } from '../src/config.js';
import { bottomGrid, fullDictionary, tinyDictionary } from './helpers.js';

/** Applique une suite d'actions et collecte tous les evenements. */
function run(state: GameState, actions: Action[], dictionary = fullDictionary) {
  const events: GameEvent[] = [];
  let current = state;
  for (const action of actions) {
    const result = step(current, action, dictionary);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** Grille de test : on colle une grille ASCII dans l'etat d'un joueur. */
function withGrid(state: GameState, ascii: string): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      P0: { ...state.players.P0, grid: gridFromAscii(ascii) },
    },
  };
}

describe('moteur', () => {
  it('cree deux joueurs des la V0', () => {
    const game = createGame(1, 2);
    expect(Object.keys(game.players)).toEqual(['P0', 'P1']);
    expect(game.players.P0.queue).toHaveLength(QUEUE_SIZE);
    expect(game.status).toBe('running');
  });

  it('donne des lettres differentes a chaque joueur (seeds distinctes)', () => {
    const game = createGame(1, 999);
    expect(game.players.P0.queue).not.toEqual(game.players.P1.queue);
  });

  it('est deterministe : meme seed + memes actions = meme etat', () => {
    const actions: Action[] = Array.from({ length: 40 }, () => ({ type: 'TICK', player: 'P0' }));
    const a = run(createGame(1234, 5678), actions).state;
    const b = run(createGame(1234, 5678), actions).state;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('fait apparaitre une lettre au premier tick', () => {
    const { state, events } = run(createGame(1, 2), [{ type: 'TICK', player: 'P0' }]);
    expect(state.players.P0.falling).not.toBeNull();
    expect(events.some((event) => event.type === 'LETTER_SPAWNED')).toBe(true);
  });

  it('fait descendre la lettre a chaque tick', () => {
    const { state } = run(createGame(1, 2), [
      { type: 'TICK', player: 'P0' },
      { type: 'TICK', player: 'P0' },
    ]);
    expect(state.players.P0.falling?.row).toBe(1);
  });

  it('bloque le deplacement contre le mur', () => {
    let { state } = run(createGame(1, 2), [{ type: 'TICK', player: 'P0' }]);
    for (let i = 0; i < GRID_COLS + 2; i += 1) {
      state = step(state, { type: 'MOVE_LEFT', player: 'P0' }, fullDictionary).state;
    }
    expect(state.players.P0.falling?.col).toBe(0);
  });

  it('efface un mot et credite le score', () => {
    const dictionary = tinyDictionary(['CHAT']);
    let state = createGame(1, 2);
    state = step(state, { type: 'TICK', player: 'P0' }, dictionary).state;
    // On installe CHA_ au sol et on force un T en chute sur la 4e colonne.
    state = withGrid(state, bottomGrid('CHA'));
    state = {
      ...state,
      players: {
        ...state.players,
        P0: { ...state.players.P0, falling: { letter: 'T', row: 0, col: 3 } },
      },
    };

    const { state: after, events } = run(state, [{ type: 'HARD_DROP', player: 'P0' }], dictionary);
    const matched = events.find((event) => event.type === 'WORD_MATCHED');
    expect(matched && matched.type === 'WORD_MATCHED' && matched.word).toBe('CHAT');
    expect(after.players.P0.score).toBeGreaterThan(0);
    expect(after.players.P0.wordsCleared).toBe(1);
    expect(gridToAscii(after.players.P0.grid)).not.toContain('CHAT');
  });

  it('route le garbage vers l adversaire, pas vers soi-meme', () => {
    const dictionary = tinyDictionary(['MAISON']);
    let state = createGame(1, 2);
    state = step(state, { type: 'TICK', player: 'P0' }, dictionary).state;
    state = withGrid(state, bottomGrid('MAISO'));
    state = {
      ...state,
      players: {
        ...state.players,
        P0: { ...state.players.P0, falling: { letter: 'N', row: 0, col: 5 } },
      },
    };

    const { state: after, events } = run(state, [{ type: 'HARD_DROP', player: 'P0' }], dictionary);
    const sent = events.find((event) => event.type === 'GARBAGE_SENT');
    expect(sent && sent.type === 'GARBAGE_SENT' && sent.to).toBe('P1');
    expect(after.players.P1.pendingGarbage).toBeGreaterThan(0);
    // Le garbage de P0 ne doit jamais atterrir dans la grille de P0.
    expect(gridToAscii(after.players.P0.grid)).not.toMatch(/[¤§¬‡]/);
  });

  it('declenche une chaine quand la gravite reforme un mot', () => {
    // ROI au sol, et au-dessus un T qui completera CHAT une fois ROI efface...
    const dictionary = tinyDictionary(['ROI', 'CHAT']);
    let state = createGame(1, 2);
    state = step(state, { type: 'TICK', player: 'P0' }, dictionary).state;
    state = withGrid(state, bottomGrid('CHA', 'ROI', ''));
    state = {
      ...state,
      players: {
        ...state.players,
        P0: { ...state.players.P0, falling: { letter: 'T', row: 0, col: 3 } },
      },
    };

    const { events } = run(state, [{ type: 'HARD_DROP', player: 'P0' }], dictionary);
    const depths = events
      .filter((event) => event.type === 'CHAIN_STEP')
      .map((event) => (event.type === 'CHAIN_STEP' ? event.depth : 0));
    expect(Math.max(...depths)).toBeGreaterThanOrEqual(2);
  });

  it('declenche l effet du mot BOOM', () => {
    const dictionary = tinyDictionary(['BOOM']);
    let state = createGame(1, 2);
    state = step(state, { type: 'TICK', player: 'P0' }, dictionary).state;
    state = withGrid(state, bottomGrid('.ZZZZZ', 'BOO'));
    state = {
      ...state,
      players: {
        ...state.players,
        P0: { ...state.players.P0, falling: { letter: 'M', row: 0, col: 3 } },
      },
    };

    const { events } = run(state, [{ type: 'HARD_DROP', player: 'P0' }], dictionary);
    const effect = events.find((event) => event.type === 'EFFECT_TRIGGERED');
    expect(effect && effect.type === 'EFFECT_TRIGGERED' && effect.effect).toBe('explosion');
    expect(effect && effect.type === 'EFFECT_TRIGGERED' && effect.cellsDestroyed).toBeGreaterThan(0);
  });

  it('termine la partie sur topping out et designe l adversaire vainqueur', () => {
    const dictionary = tinyDictionary([]);
    let state = createGame(1, 2);
    state = step(state, { type: 'TICK', player: 'P0' }, dictionary).state;
    // Colonne 0 remplie sauf la case du haut, ou la lettre va se verrouiller.
    state = withGrid(state, bottomGrid(...Array.from({ length: GRID_ROWS - 1 }, () => 'X')));
    state = {
      ...state,
      players: {
        ...state.players,
        P0: { ...state.players.P0, falling: { letter: 'Q', row: 0, col: 0 } },
      },
    };

    const { state: after, events } = run(state, [{ type: 'HARD_DROP', player: 'P0' }], dictionary);
    expect(events.some((event) => event.type === 'TOPOUT')).toBe(true);
    expect(after.status).toBe('over');
    expect(after.winner).toBe('P1');
  });

  it('ignore les actions apres la fin de partie', () => {
    const dictionary = tinyDictionary([]);
    const over: GameState = { ...createGame(1, 2), status: 'over', winner: 'P1' };
    const { events } = run(over, [{ type: 'TICK', player: 'P0' }], dictionary);
    expect(events).toHaveLength(0);
  });

  it('connait l adversaire de chaque joueur', () => {
    expect(opponentOf('P0')).toBe('P1');
    expect(opponentOf('P1')).toBe('P0');
  });
});
