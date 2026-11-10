import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryNetworkTransport } from '../src/memory-network-transport';

describe('InMemoryNetworkTransport (NetworkTransport contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('joins session, throttles token moves to <= 10 Hz, and emits dice rolls', async () => {
    const transport = new InMemoryNetworkTransport();
    const events: unknown[] = [];
    const unsubscribe = transport.onStateEvent((ev) => events.push(ev));

    await transport.joinSession('ROOM-1', 'Alice', true);
    expect(events).toHaveLength(1);

    // Burst 5 token moves inside 40ms
    transport.emitTokenMove('t1', 10, 10);
    transport.emitTokenMove('t1', 20, 20);
    transport.emitTokenMove('t1', 30, 30);

    // Only leading move emitted immediately
    expect(events).toHaveLength(2);

    vi.advanceTimersByTime(110);
    // Trailing move emitted with latest coordinates
    expect(events).toHaveLength(3);
    expect(events[2]).toMatchObject({ type: 'token:moved', tokenId: 't1', x: 30, y: 30 });

    transport.emitDiceRoll('1d20+5', { expression: '1d20+5', total: 19, rolls: [14], modifier: 5 });
    expect(events).toHaveLength(4);

    unsubscribe();
    await transport.leaveSession();
  });
});
