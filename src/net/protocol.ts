/**
 * Protocole reseau — declare AVANT d'avoir un reseau, volontairement.
 *
 * Ces types sont la forme exacte des messages qui transiteront en WebSocket.
 * Les declarer maintenant force le moteur a rester serialisable et empeche de
 * bricoler des raccourcis locaux qu'il faudrait defaire plus tard.
 *
 * [NET] Aucun de ces messages n'est encore envoye sur un vrai socket. Ils sont
 * tous produits, logges et routes en memoire par `net/local.ts`.
 */
import type { Action, PlayerId } from '../core/types.js';

/** Client -> serveur. */
export type ClientMessage =
  | { type: 'JOIN'; roomId: string; playerName: string }
  | { type: 'INPUT'; action: Action; clientTick: number }
  | { type: 'PING'; sentAt: number };

/** Serveur -> client. */
export type ServerMessage =
  | { type: 'MATCH_START'; you: PlayerId; opponent: PlayerId; seeds: Record<PlayerId, number> }
  /**
   * Le serveur est autoritaire : il pousse l'etat qu'il a calcule, le client
   * ne fait que le rendre. Le client peut prevalider en local pour le feedback
   * instantane, mais c'est ce message qui fait foi en cas de divergence.
   */
  | { type: 'STATE_SYNC'; tick: number; payload: unknown }
  | { type: 'GARBAGE_INCOMING'; from: PlayerId; rows: number }
  | { type: 'MATCH_END'; winner: PlayerId | null }
  | { type: 'PONG'; sentAt: number; serverTime: number };
