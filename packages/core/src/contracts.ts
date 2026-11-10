export type ToolMode = 'select' | 'pan' | 'ruler' | 'fog' | 'dice';

export interface GridConfig {
  size: number;
  type: 'square' | 'hex';
}

export interface TokenState {
  id: string;
  name: string;
  x: number;
  y: number;
  imageUrl: string;
  hp?: [current: number, max: number];
}

export interface DiceRollResult {
  expression: string;
  total: number;
  rolls: number[];
  modifier: number;
}

export interface FogPatch {
  mode: 'reveal' | 'hide';
  rects: Array<[x: number, y: number, w: number, h: number]>;
}

export type SessionEvent =
  | { type: 'session:joined'; roomId: string; displayName: string; isHost: boolean }
  | { type: 'session:left' }
  | { type: 'token:moved'; tokenId: string; x: number; y: number }
  | { type: 'dice:rolled'; actor: string; result: DiceRollResult; timestamp: number }
  | { type: 'fog:patched'; patch: FogPatch }
  | { type: 'presence:changed'; count: number };

export interface NetworkTransport {
  joinSession(roomId: string, displayName: string, isHost: boolean): Promise<void>;
  leaveSession(): Promise<void>;
  emitTokenMove(tokenId: string, x: number, y: number): void;
  emitDiceRoll(expression: string, result: DiceRollResult): void;
  emitFogPatch(patch: FogPatch): void;
  onStateEvent(handler: (event: SessionEvent) => void): () => void;
}

export interface AssetReference {
  url: string;
  hash: string;
}

export interface AssetProvider {
  resolveAssetUrl(assetIdOrUrl: string): Promise<AssetReference>;
}
