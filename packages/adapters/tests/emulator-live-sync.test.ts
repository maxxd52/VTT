import { describe, expect, it } from 'vitest';
import { FirebaseRTDBTransport } from '../src/firebase-rtdb-transport';

describe('Firebase RTDB Emulator Live Sync', () => {
  it('synchronizes token moves and dice rolls across two independent client transports', async () => {
    const transportA = new FirebaseRTDBTransport({
      useEmulator: true,
      emulatorHost: '127.0.0.1',
      databasePort: 9000,
      authPort: 9099
    });

    const transportB = new FirebaseRTDBTransport({
      useEmulator: true,
      emulatorHost: '127.0.0.1',
      databasePort: 9000,
      authPort: 9099
    });

    const eventsA: any[] = [];
    const eventsB: any[] = [];

    transportA.onStateEvent((e) => eventsA.push(e));
    transportB.onStateEvent((e) => eventsB.push(e));

    const roomId = `ROOM-SYNC-${Date.now()}`;

    // Join room
    await transportA.joinSession(roomId, 'Game Master', true);
    await transportB.joinSession(roomId, 'Incognito Player', false);

    // Wait a brief tick for WebSocket handshake
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Client A moves token
    transportA.emitTokenMove('token-warrior', 320, 480);

    // Wait for RTDB propagation to Client B
    await new Promise((resolve) => setTimeout(resolve, 600));

    const moveOnB = eventsB.find((e) => e.type === 'token:moved' && e.tokenId === 'token-warrior');
    expect(moveOnB).toBeDefined();
    expect(moveOnB?.x).toBe(320);
    expect(moveOnB?.y).toBe(480);

    // Client B rolls dice
    transportB.emitDiceRoll('2d6+4', {
      expression: '2d6+4',
      total: 12,
      rolls: [4, 4],
      modifier: 4
    });

    // Wait for RTDB propagation to Client A
    await new Promise((resolve) => setTimeout(resolve, 600));

    const rollOnA = eventsA.find((e) => e.type === 'dice:rolled');
    expect(rollOnA).toBeDefined();
    expect(rollOnA?.actor).toBe('Incognito Player');
    expect(rollOnA?.result.total).toBe(12);

    await transportA.leaveSession();
    await transportB.leaveSession();
  });
});
