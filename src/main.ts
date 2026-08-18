/**
 * Point d'entree : boucle de jeu, cablage moteur <-> UI <-> transport.
 *
 * Architecture de la boucle : c'est la SEULE partie du code qui connait le
 * temps reel. Elle traduit l'ecoulement du temps en actions `TICK`, exactement
 * comme un serveur autoritaire le ferait a partir de son propre horloge.
 */
import wordsRaw from './dict/words-fr.txt?raw';

import { createGame, step } from './core/engine.js';
import type { Action, GameState, PlayerId } from './core/types.js';
import { Dictionary } from './dict/dictionary.js';
import { seedFromString } from './core/rng.js';
import { chooseBotAction } from './ai/bot.js';
import { render } from './ui/render.js';
import { bindKeyboard } from './ui/input.js';
import { logEvent } from './ui/event-log.js';
import { log, netLog } from './ui/log.js';
import { LocalTransport } from './net/local.js';
import { FALL_INTERVAL_MS } from './config.js';

const YOU: PlayerId = 'P0';
const OPPONENT: PlayerId = 'P1';

const dictionary = Dictionary.fromText(wordsRaw);
log('DICT', 'LOADED', { words: dictionary.size });

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app introuvable');

/**
 * Transport local. Il ne porte encore aucun etat de jeu : son role en V0 est de
 * prouver que la poignee de main et la serialisation fonctionnent, et de laisser
 * une trace `[LEXA][NET]` dans la console a chaque fois qu'un vrai socket serait
 * sollicite.
 *
 * [NET] Remplacer par `new WebSocketTransport(url)` — rien d'autre a changer ici.
 */
const transport = new LocalTransport({
  latencyMs: 0, // passer a 120 pour eprouver le ressenti reseau
  onClientMessage: (message, reply) => {
    // [NET] Ce bloc est la maquette du serveur autoritaire. En production il
    // vit ailleurs, valide l'action, l'applique sur SON etat, et repond.
    if (message.type === 'JOIN') {
      reply({
        type: 'MATCH_START',
        you: YOU,
        opponent: OPPONENT,
        seeds: { P0: seedFromString('lexa-p0'), P1: seedFromString('lexa-p1') },
      });
    }
  },
});

transport.onMessage((message) => {
  if (message.type === 'MATCH_START') {
    log('NET', 'MATCH_START', { you: message.you, opponent: message.opponent });
  }
});

let state: GameState;
let lastFall = 0;
let lastBotMove = 0;
let rafId = 0;

function apply(action: Action): void {
  const result = step(state, action, dictionary);
  state = result.state;
  for (const event of result.events) logEvent(event);
  render({ root: root as HTMLElement }, state, YOU);
}

function newGame(): void {
  // Seeds distinctes par joueur (brief §5) : les deux grilles ne recoivent pas
  // les memes lettres, contrairement a un versus a seed partagee.
  state = createGame(seedFromString(`p0-${Date.now()}`), seedFromString(`p1-${Date.now()}`));
  lastFall = performance.now();
  lastBotMove = lastFall;

  // [NET] Poignee de main. En vrai PvP, on attendrait MATCH_START avant de
  // demarrer la boucle, au lieu de lancer la partie immediatement.
  netLog('JOIN', { room: 'local-solo', you: YOU });
  transport.send({ type: 'JOIN', roomId: 'local-solo', playerName: 'joueur' });

  apply({ type: 'TICK', player: YOU });
  apply({ type: 'TICK', player: OPPONENT });
  log('STATE', 'GAME_START', { seedMode: 'per-player' });
}

/**
 * Boucle principale. Le bot bouge sur sa propre cadence, deliberement decouplee
 * de celle du joueur : c'est deja le comportement de deux clients independants.
 */
function loop(now: number): void {
  rafId = requestAnimationFrame(loop);
  if (state.status === 'over') return;

  if (now - lastFall >= FALL_INTERVAL_MS) {
    lastFall = now;
    apply({ type: 'TICK', player: YOU });
  }

  // [NET] En vrai PvP, ce bloc disparait : les actions de l'adversaire arrivent
  // par `transport.onMessage`, elles ne sont pas calculees localement.
  if (now - lastBotMove >= FALL_INTERVAL_MS / 3) {
    lastBotMove = now;
    apply(chooseBotAction(state, OPPONENT, dictionary));
  }
}

bindKeyboard(YOU, apply, () => {
  cancelAnimationFrame(rafId);
  newGame();
  rafId = requestAnimationFrame(loop);
});

newGame();
rafId = requestAnimationFrame(loop);
