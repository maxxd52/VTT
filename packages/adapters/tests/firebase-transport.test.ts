import { describe, expect, it, vi } from 'vitest';
import { FirebaseRTDBTransport } from '../src/firebase-rtdb-transport';

describe('FirebaseRTDBTransport', () => {
  it('falls back to local broadcast when no Firebase credentials are configured', async () => {
    const transport = new FirebaseRTDBTransport();
    const events: any[] = [];

    transport.onStateEvent((event) => events.push(event));

    await transport.joinSession('ROOM-42', 'Gandalf', true);
    expect(events).toContainEqual({
      type: 'session:joined',
      roomId: 'ROOM-42',
      displayName: 'Gandalf',
      isHost: true
    });

    transport.emitTokenMove('token-1', 120, 240);
    expect(events).toContainEqual({
      type: 'token:moved',
      tokenId: 'token-1',
      x: 120,
      y: 240
    });

    transport.emitDiceRoll('1d20+3', {
      expression: '1d20+3',
      total: 18,
      rolls: [15],
      modifier: 3
    });

    const rollEvent = events.find((e) => e.type === 'dice:rolled');
    expect(rollEvent).toBeDefined();
    expect(rollEvent.actor).toBe('Gandalf');
    expect(rollEvent.result.total).toBe(18);

    await transport.leaveSession();
    expect(events).toContainEqual({ type: 'session:left' });
  });

  it('unsubscribes listeners cleanly on leaveSession', async () => {
    const transport = new FirebaseRTDBTransport();
    let count = 0;
    const unsub = transport.onStateEvent(() => {
      count++;
    });

    await transport.joinSession('ROOM-1', 'Hero', false);
    expect(count).toBe(1);

    unsub();
    transport.emitTokenMove('t1', 10, 20);
    expect(count).toBe(1); // handler removed
  });
});
