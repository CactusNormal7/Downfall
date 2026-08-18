/**
 * Transport local — le multijoueur "simule".
 *
 * Il implemente exactement la meme interface que le futur transport WebSocket :
 * messages serialises, latence artificielle, livraison asynchrone. Le jeu ne
 * peut donc pas developper l'habitude de supposer que l'autre joueur repond
 * instantanement, ce qui est le piege classique d'un solo qu'on "passera en
 * multi plus tard".
 *
 * [NET] Remplacer par `WebSocketTransport` le jour du vrai PvP. Rien d'autre
 * ne doit changer dans le reste du code.
 */
import type { Transport } from './transport.js';
import type { ClientMessage, ServerMessage } from './protocol.js';
import { netLog } from '../ui/log.js';

export interface LocalTransportOptions {
  /** Latence simulee en ms. Mettre 80-150 pour tester le ressenti reseau. */
  latencyMs?: number;
  /** Repondeur local qui joue le role du serveur autoritaire. */
  onClientMessage?: (message: ClientMessage, reply: (message: ServerMessage) => void) => void;
}

export class LocalTransport implements Transport {
  readonly latencyMs: number;
  private handlers: Array<(message: ServerMessage) => void> = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private closed = false;
  private readonly onClientMessage: LocalTransportOptions['onClientMessage'];

  constructor(options: LocalTransportOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.onClientMessage = options.onClientMessage;
  }

  send(message: ClientMessage): void {
    if (this.closed) return;

    // La serialisation n'est pas decorative : elle prouve a chaque envoi que le
    // message passerait vraiment sur un socket. Si un jour un objet non
    // serialisable se glisse dans une action, ca pete ICI et pas en production.
    const wire = JSON.stringify(message);
    netLog('SEND', { type: message.type, bytes: wire.length, latency: this.latencyMs });

    const decoded = JSON.parse(wire) as ClientMessage;
    this.after(() => this.onClientMessage?.(decoded, (reply) => this.deliver(reply)));
  }

  onMessage(handler: (message: ServerMessage) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((entry) => entry !== handler);
    };
  }

  private deliver(message: ServerMessage): void {
    if (this.closed) return;
    netLog('RECV', { type: message.type });
    this.after(() => {
      for (const handler of this.handlers) handler(message);
    });
  }

  private after(task: () => void): void {
    if (this.latencyMs <= 0) {
      task();
      return;
    }
    this.timers.push(setTimeout(task, this.latencyMs));
  }

  close(): void {
    this.closed = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    this.handlers = [];
    netLog('CLOSE', { reason: 'client' });
  }
}
