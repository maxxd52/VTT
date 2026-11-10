import {
  type DiceRollResult,
  type FogPatch,
  type NetworkTransport,
  type SessionEvent,
  createThrottledEmitter
} from '@vtt/core';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  type Auth,
  type User
} from 'firebase/auth';
import {
  connectDatabaseEmulator,
  getDatabase,
  off,
  onDisconnect,
  onValue,
  push,
  ref,
  set,
  update,
  type Database,
  type Unsubscribe
} from 'firebase/database';

export interface FirebaseTransportConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface FirebaseTransportOptions {
  config?: FirebaseTransportConfig;
  app?: FirebaseApp;
  auth?: Auth;
  database?: Database;
  useEmulator?: boolean;
  emulatorHost?: string;
  authPort?: number;
  databasePort?: number;
}

export class FirebaseRTDBTransport implements NetworkTransport {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Database | null = null;

  private currentUser: User | null = null;
  private currentRoomId: string | null = null;
  private currentDisplayName = 'Player';
  private currentIsHost = false;

  private eventHandlers = new Set<(event: SessionEvent) => void>();
  private activeListeners: Array<() => void> = [];
  private readonly throttledMove: (tokenId: string, x: number, y: number) => void;

  constructor(options: FirebaseTransportOptions = {}) {
    const host = options.emulatorHost || '127.0.0.1';
    const authPort = options.authPort || 9099;
    const dbPort = options.databasePort || 9000;

    if (options.app) {
      this.app = options.app;
      this.auth = options.auth ?? getAuth(this.app);
      this.db = options.database ?? getDatabase(this.app);
    } else if (options.config) {
      this.app = getApps().length === 0 ? initializeApp(options.config) : getApp();
      this.auth = getAuth(this.app);
      this.db = getDatabase(this.app);
    } else if (options.useEmulator) {
      const emulatorConfig: FirebaseTransportConfig = {
        apiKey: 'demo-vtt-key',
        authDomain: 'localhost',
        databaseURL: `http://${host}:${dbPort}/?ns=demo-vtt-default-rtdb`,
        projectId: 'demo-vtt'
      };
      this.app = getApps().length === 0 ? initializeApp(emulatorConfig) : getApp();
      this.auth = getAuth(this.app);
      this.db = getDatabase(this.app);
    }

    if (options.useEmulator && this.auth && this.db) {
      try {
        connectAuthEmulator(this.auth, `http://${host}:${authPort}`, { disableWarnings: true });
      } catch {
        // Ignore if already connected
      }
      try {
        connectDatabaseEmulator(this.db, host, dbPort);
      } catch {
        // Ignore if already connected
      }
    }

    this.throttledMove = createThrottledEmitter((tokenId: string, x: number, y: number) => {
      if (this.db && this.currentRoomId) {
        const tokenRef = ref(this.db, `active_sessions/${this.currentRoomId}/tokens/${tokenId}`);
        void update(tokenRef, { x, y });
      } else {
        this.broadcastEvent({ type: 'token:moved', tokenId, x, y });
      }
    }, 100);
  }

  async joinSession(roomId: string, displayName: string, isHost: boolean): Promise<void> {
    this.currentRoomId = roomId;
    this.currentDisplayName = displayName;
    this.currentIsHost = isHost;

    if (!this.auth || !this.db) {
      // In-memory fallback if Firebase credentials are not provided
      this.broadcastEvent({
        type: 'session:joined',
        roomId,
        displayName,
        isHost
      });
      return;
    }

    // 1. Anonymous Authentication (Zero-friction join invariant)
    try {
      const userCred = await signInAnonymously(this.auth);
      this.currentUser = userCred.user;
    } catch (err) {
      console.warn('[FirebaseRTDBTransport] Auth/Connection failed, falling back to local session:', err);
      this.broadcastEvent({
        type: 'session:joined',
        roomId,
        displayName,
        isHost
      });
      return;
    }

    const sessionRoot = `active_sessions/${roomId}`;

    // 2. Register Presence
    const presenceRef = ref(this.db, `${sessionRoot}/presence/${this.currentUser.uid}`);
    await onDisconnect(presenceRef).remove();
    await set(presenceRef, {
      displayName,
      isHost,
      joinedAt: Date.now()
    });

    // 3. Initialize Host Meta (if Host)
    if (isHost) {
      const metaRef = ref(this.db, `${sessionRoot}/meta`);
      await update(metaRef, {
        hostUid: this.currentUser.uid,
        expiresAt: Date.now() + 3 * 3600 * 1000 // 3-hour session window
      });
    }

    // 4. Listen to Live Tokens
    const tokensRef = ref(this.db, `${sessionRoot}/tokens`);
    const unsubscribeTokens = onValue(tokensRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) return;
      for (const [tokenId, data] of Object.entries(val)) {
        const token = data as { x: number; y: number };
        if (typeof token.x === 'number' && typeof token.y === 'number') {
          this.broadcastEvent({
            type: 'token:moved',
            tokenId,
            x: token.x,
            y: token.y
          });
        }
      }
    });
    this.activeListeners.push(() => unsubscribeTokens());

    // 5. Listen to Live Dice Rolls
    const rollsRef = ref(this.db, `${sessionRoot}/rolls`);
    const unsubscribeRolls = onValue(rollsRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) return;
      const entries = Object.values(val) as Array<{
        actor: string;
        expression: string;
        total: number;
        rolls: number[];
        modifier?: number;
        timestamp: number;
      }>;
      const latest = entries[entries.length - 1];
      if (latest && latest.timestamp) {
        this.broadcastEvent({
          type: 'dice:rolled',
          actor: latest.actor,
          result: {
            expression: latest.expression,
            total: latest.total,
            rolls: latest.rolls ?? [latest.total],
            modifier: latest.modifier ?? 0
          },
          timestamp: latest.timestamp
        });
      }
    });
    this.activeListeners.push(() => unsubscribeRolls());

    // 6. Listen to Fog of War
    const fogRef = ref(this.db, `${sessionRoot}/fog`);
    const unsubscribeFog = onValue(fogRef, (snapshot) => {
      const val = snapshot.val();
      if (val && Array.isArray(val.rects)) {
        this.broadcastEvent({
          type: 'fog:patched',
          patch: {
            mode: val.mode ?? 'reveal',
            rects: val.rects
          }
        });
      }
    });
    this.activeListeners.push(() => unsubscribeFog());

    this.broadcastEvent({
      type: 'session:joined',
      roomId,
      displayName,
      isHost
    });
  }

  async leaveSession(): Promise<void> {
    for (const unsub of this.activeListeners) {
      unsub();
    }
    this.activeListeners = [];

    if (this.db && this.currentRoomId && this.currentUser) {
      const presenceRef = ref(this.db, `active_sessions/${this.currentRoomId}/presence/${this.currentUser.uid}`);
      try {
        await set(presenceRef, null);
      } catch {
        // Ignored during teardown
      }
    }

    this.broadcastEvent({ type: 'session:left' });
    this.currentRoomId = null;
  }

  emitTokenMove(tokenId: string, x: number, y: number): void {
    this.throttledMove(tokenId, x, y);
  }

  emitDiceRoll(expression: string, result: DiceRollResult): void {
    if (!this.db || !this.currentRoomId) {
      this.broadcastEvent({
        type: 'dice:rolled',
        actor: this.currentDisplayName,
        result,
        timestamp: Date.now()
      });
      return;
    }

    const rollsRef = ref(this.db, `active_sessions/${this.currentRoomId}/rolls`);
    void push(rollsRef, {
      actor: this.currentDisplayName,
      expression: result.expression,
      total: result.total,
      rolls: result.rolls,
      modifier: result.modifier,
      timestamp: Date.now()
    });
  }

  emitFogPatch(patch: FogPatch): void {
    if (!this.db || !this.currentRoomId) {
      this.broadcastEvent({ type: 'fog:patched', patch });
      return;
    }

    const fogRef = ref(this.db, `active_sessions/${this.currentRoomId}/fog`);
    void set(fogRef, {
      mode: patch.mode,
      rects: patch.rects
    });
  }

  onStateEvent(handler: (event: SessionEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  private broadcastEvent(event: SessionEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('Error in session event handler:', err);
      }
    }
  }
}
