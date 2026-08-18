/**
 * Clavier -> Actions.
 *
 * La couche entree ne connait que des `Action` serialisables : elle produit
 * exactement ce qui partirait sur le reseau. [NET] En vrai PvP, ces memes
 * actions seraient emballees dans un message { type: 'INPUT', action, clientTick }.
 */
import type { Action, PlayerId } from '../core/types.js';
import { log } from './log.js';

export type InputSink = (action: Action) => void;

export function bindKeyboard(player: PlayerId, sink: InputSink, onRestart: () => void): () => void {
  const handler = (event: KeyboardEvent) => {
    let action: Action | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        action = { type: 'MOVE_LEFT', player };
        break;
      case 'ArrowRight':
        action = { type: 'MOVE_RIGHT', player };
        break;
      case 'ArrowDown':
        action = { type: 'SOFT_DROP', player };
        break;
      case ' ':
        action = { type: 'HARD_DROP', player };
        break;
      case 'Enter':
        event.preventDefault();
        onRestart();
        return;
      default:
        return;
    }

    event.preventDefault();
    log('INPUT', 'KEY', { key: event.key, action: action.type });
    sink(action);
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
