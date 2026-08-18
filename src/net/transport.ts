/**
 * Interface de transport.
 *
 * Tout le jeu ne parle QUE a cette interface. Passer au vrai PvP consistera a
 * ecrire une seconde implementation (`WebSocketTransport`) et a la brancher a
 * la place de `LocalTransport` — sans toucher au moteur ni a l'UI.
 */
import type { ClientMessage, ServerMessage } from './protocol.js';

export interface Transport {
  /** Envoie un message vers le "serveur". */
  send(message: ClientMessage): void;
  /** S'abonne aux messages venant du "serveur". Rend une fonction de desabonnement. */
  onMessage(handler: (message: ServerMessage) => void): () => void;
  /** Latence aller-retour observee, en ms. 0 en local. */
  readonly latencyMs: number;
  close(): void;
}
