import { describe, expect, it, vi } from 'vitest';
import { FirebaseRTDBTransport } from '../src/firebase-rtdb-transport';

function createClient(): FirebaseRTDBTransport {
  return new FirebaseRTDBTransport({
    useEmulator: true,
    emulatorHost: '127.0.0.1',
    databasePort: 9000,
    authPort: 9099
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Firebase RTDB Emulator Live Sync', () => {
  it('synchronizes token moves, dice rolls and fog across two independent clients', async () => {
    const gm = createClient();
    const player = createClient();

    const gmEvents: any[] = [];
    const playerEvents: any[] = [];
    gm.onStateEvent((e) => gmEvents.push(e));
    player.onStateEvent((e) => playerEvents.push(e));

    const roomId = `ROOM-SYNC-${Date.now()}`;
    await gm.joinSession(roomId, 'Game Master', true);
    await player.joinSession(roomId, 'Incognito Player', false);
    await wait(500);

    // GM moves a token -> player sees it
    gm.emitTokenMove('token-warrior', 320, 480);
    await wait(600);
    const moveOnPlayer = playerEvents.find((e) => e.type === 'token:moved' && e.tokenId === 'token-warrior');
    expect(moveOnPlayer).toMatchObject({ x: 320, y: 480 });

    // Player moves a token -> GM sees it
    player.emitTokenMove('token-rogue', 60, 120);
    await wait(600);
    const moveOnGm = gmEvents.find((e) => e.type === 'token:moved' && e.tokenId === 'token-rogue');
    expect(moveOnGm).toMatchObject({ x: 60, y: 120 });

    // Player rolls dice -> GM sees it
    player.emitDiceRoll('2d6+4', { expression: '2d6+4', total: 12, rolls: [4, 4], modifier: 4 });
    await wait(600);
    const rollOnGm = gmEvents.find((e) => e.type === 'dice:rolled');
    expect(rollOnGm?.actor).toBe('Incognito Player');
    expect(rollOnGm?.result.total).toBe(12);

    // GM patches fog -> player sees it
    gm.emitFogPatch({ mode: 'hide', rects: [[0, 0, 60, 60]] });
    await wait(600);
    const fogOnPlayer = playerEvents.find((e) => e.type === 'fog:patched');
    expect(fogOnPlayer?.patch.rects).toEqual([[0, 0, 60, 60]]);

    await gm.leaveSession();
    await player.leaveSession();
  }, 15000);

  it('lets a new GM session take over a room (even if an older session existed) and keeps syncing', async () => {
    const roomId = `ROOM-TAKEOVER-${Date.now()}`;

    const oldGm = createClient();
    await oldGm.joinSession(roomId, 'Old GM', true);

    const newGm = createClient();
    const player = createClient();
    const gmEvents: any[] = [];
    const playerEvents: any[] = [];
    newGm.onStateEvent((e) => gmEvents.push(e));
    player.onStateEvent((e) => playerEvents.push(e));

    const errors = vi.spyOn(console, 'error');
    await newGm.joinSession(roomId, 'New GM', true);
    await player.joinSession(roomId, 'Player', false);
    await wait(500);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();

    // Player -> New GM token sync works
    player.emitTokenMove('token-1', 30, 90);
    await wait(600);
    expect(gmEvents.find((e) => e.type === 'token:moved' && e.tokenId === 'token-1')).toMatchObject({ x: 30, y: 90 });

    // New GM can write fog (host-only) and the player receives it
    newGm.emitFogPatch({ mode: 'hide', rects: [[0, 0, 60, 60]] });
    await wait(600);
    expect(playerEvents.find((e) => e.type === 'fog:patched')?.patch.rects).toEqual([[0, 0, 60, 60]]);

    // Presence count reaches all clients
    expect(gmEvents.filter((e) => e.type === 'presence:changed').at(-1)?.count).toBe(3);

    await oldGm.leaveSession();
    await newGm.leaveSession();
    await player.leaveSession();
  }, 15000);

  it('rejects non-host fog writes and surfaces the rejection via console.error', async () => {
    const roomId = `ROOM-NONHOST-FOG-${Date.now()}`;
    const gm = createClient();
    const player = createClient();
    const gmEvents: any[] = [];
    gm.onStateEvent((e) => gmEvents.push(e));

    await gm.joinSession(roomId, 'GM', true);
    await player.joinSession(roomId, 'Player', false);
    await wait(400);

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    player.emitFogPatch({ mode: 'hide', rects: [[0, 0, 60, 60]] });
    await wait(600);
    expect(errors.mock.calls.some((args) => String(args[0]).includes('fog patch was rejected'))).toBe(true);
    errors.mockRestore();

    expect(gmEvents.find((e) => e.type === 'fog:patched')).toBeUndefined();

    await gm.leaveSession();
    await player.leaveSession();
  }, 15000);

  it('replays full fog history and past rolls to a late joiner', async () => {
    const roomId = `ROOM-LATE-${Date.now()}`;
    const gm = createClient();
    await gm.joinSession(roomId, 'GM', true);
    await wait(300);

    gm.emitFogPatch({ mode: 'hide', rects: [[0, 0, 60, 60]] });
    gm.emitFogPatch({ mode: 'hide', rects: [[60, 0, 60, 60]] });
    gm.emitDiceRoll('1d6', { expression: '1d6', total: 4, rolls: [4], modifier: 0 });
    gm.emitDiceRoll('1d8', { expression: '1d8', total: 7, rolls: [7], modifier: 0 });
    await wait(600);

    const late = createClient();
    const lateEvents: any[] = [];
    late.onStateEvent((e) => lateEvents.push(e));
    await late.joinSession(roomId, 'Late Player', false);
    await wait(600);

    const fog = lateEvents.filter((e) => e.type === 'fog:patched').map((e) => e.patch.rects[0]);
    expect(fog).toEqual([[0, 0, 60, 60], [60, 0, 60, 60]]);
    const rolls = lateEvents.filter((e) => e.type === 'dice:rolled').map((e) => e.result.expression);
    expect(rolls).toEqual(['1d6', '1d8']);

    await gm.leaveSession();
    await late.leaveSession();
  }, 15000);
});
