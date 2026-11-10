import {
  createThrottledEmitter,
  type DiceRollResult,
  type FogPatch,
  type NetworkTransport,
  type SessionEvent
} from '@vtt/core';

/**
 * Local in-memory implementation of NetworkTransport used for Slice 1 preview
 * and deterministic tests before Firebase RTDB wiring in Slice 3.
 */
export class InMemoryNetworkTransport implements NetworkTransport {
  private listeners = new Set<(event: SessionEvent) => void>();
  private actorName = 'Player';
  private roomId: string | null = null;
  private readonly throttledMove: (tokenId: string, x: number, y: number) => void;

  constructor(throttleMs = 100) {
    this.throttledMove = createThrottledEmitter((tokenId: string, x: number, y: number) => {
      this.broadcast({ type: 'token:moved', tokenId, x, y });
    }, throttleMs);
  }

  async joinSession(roomId: string, displayName: string, isHost: boolean): Promise<void> {
    this.roomId = roomId;
    this.actorName = displayName;
    this.broadcast({ type: 'session:joined', roomId, displayName, isHost });
  }

  async leaveSession(): Promise<void> {
    if (this.roomId !== null) {
      this.roomId = null;
      this.broadcast({ type: 'session:left' });
    }
    this.listeners.clear();
  }

  emitTokenMove(tokenId: string, x: number, y: number): void {
    this.throttledMove(tokenId, x, y);
  }

  emitDiceRoll(_expression: string, result: DiceRollResult): void {
    this.broadcast({
      type: 'dice:rolled',
      actor: this.actorName,
      result,
      timestamp: Date.now()
    });
  }

  emitFogPatch(patch: FogPatch): void {
    this.broadcast({ type: 'fog:patched', patch });
  }

  onStateEvent(handler: (event: SessionEvent) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private broadcast(event: SessionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
