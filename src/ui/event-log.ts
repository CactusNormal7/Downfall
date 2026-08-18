/**
 * Pont evenements -> logs.
 *
 * C'est le seul endroit ou un GameEvent devient du texte. Le moteur reste muet,
 * donc rejouable et testable en silence ; le debug se branche ici.
 */
import type { GameEvent } from '../core/types.js';
import { log } from './log.js';

export function logEvent(event: GameEvent): void {
  switch (event.type) {
    case 'LETTER_SPAWNED':
      log('SPAWN', 'LETTER', { player: event.player, letter: event.letter, queue: event.queue.join(',') });
      break;
    case 'LETTER_LOCKED':
      log('SPAWN', 'LOCK', { player: event.player, letter: event.letter, row: event.row, col: event.col });
      break;
    case 'WORD_MATCHED':
      log('WORD', 'MATCH', {
        player: event.player,
        word: event.word,
        len: event.word.length,
        row: event.row,
        cols: `${event.fromCol}-${event.toCol}`,
        score: event.score,
        chain: event.chainDepth,
      });
      break;
    case 'CHAIN_STEP':
      // A grepper pour calibrer CHAIN_MULTIPLIER_STEP en playtest.
      // Le champ `grid` sert a l'animation (ui/render.ts) ; on ne le logge pas,
      // une grille entiere par ligne rendrait les logs illisibles.
      log('CHAIN', 'STEP', { player: event.player, depth: event.depth, multiplier: event.multiplier });
      break;
    case 'BOARD_SETTLED':
      // Idem : sert uniquement a l'animation, pas de grille dans les logs.
      break;
    case 'GARBAGE_SENT':
      // [NET] En vrai PvP, cet evenement declenche l'envoi du message
      // { type: 'GARBAGE_SEND', from, to, rows, tick } au serveur autoritaire.
      log('NET', 'GARBAGE_SEND', { from: event.from, to: event.to, rows: event.rows, word: event.word });
      break;
    case 'GARBAGE_APPLIED':
      log('GARBAGE', 'APPLIED', { player: event.player, rows: event.rows });
      break;
    case 'WILDCARD_GRANTED':
      log('STATE', 'WILDCARD', { player: event.player, drySpell: event.drySpell });
      break;
    case 'EFFECT_TRIGGERED':
      log('EFFECT', 'TRIGGER', {
        player: event.player,
        word: event.word,
        effect: event.effect,
        destroyed: event.cellsDestroyed,
      });
      break;
    case 'TOPOUT':
      log('STATE', 'TOPOUT', { player: event.player });
      break;
    case 'GAME_OVER':
      log('STATE', 'GAME_OVER', { winner: event.winner ?? 'none' });
      break;
  }
}
