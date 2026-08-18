import { describe, expect, it } from 'vitest';
import { LocalTransport } from '../src/net/local.js';
import type { Action } from '../src/core/types.js';

describe('transport local (multijoueur simule)', () => {
  it('serialise les messages comme le ferait un vrai socket', () => {
    // La garantie centrale du multi simule : si une action cesse d'etre
    // serialisable, ca doit casser ici et pas le jour du branchement reseau.
    const action: Action = { type: 'HARD_DROP', player: 'P0' };
    const transport = new LocalTransport({
      onClientMessage: (message, reply) => {
        expect(JSON.parse(JSON.stringify(message))).toEqual(message);
        reply({ type: 'MATCH_END', winner: 'P0' });
      },
    });

    const received: string[] = [];
    transport.onMessage((message) => received.push(message.type));
    transport.send({ type: 'INPUT', action, clientTick: 7 });

    expect(received).toEqual(['MATCH_END']);
    transport.close();
  });

  it('livre les reponses du serveur simule', () => {
    const transport = new LocalTransport({
      onClientMessage: (message, reply) => {
        if (message.type === 'JOIN') {
          reply({ type: 'MATCH_START', you: 'P0', opponent: 'P1', seeds: { P0: 1, P1: 2 } });
        }
      },
    });

    let start: unknown = null;
    transport.onMessage((message) => {
      if (message.type === 'MATCH_START') start = message;
    });
    transport.send({ type: 'JOIN', roomId: 'r', playerName: 'joueur' });

    expect(start).toMatchObject({ you: 'P0', opponent: 'P1' });
    transport.close();
  });

  it('ne livre plus rien apres fermeture', () => {
    const transport = new LocalTransport({
      onClientMessage: (_message, reply) => reply({ type: 'MATCH_END', winner: null }),
    });
    const received: string[] = [];
    transport.onMessage((message) => received.push(message.type));
    transport.close();
    transport.send({ type: 'PING', sentAt: 0 });
    expect(received).toHaveLength(0);
  });
});
