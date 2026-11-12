import {
  type DiceRollResult,
  type FogPatch,
  type NetworkTransport,
  type SessionEvent,
  createThrottledEmitter
} from '@vtt/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
   setPersistence,
  signInAnonymously,
  type Auth,
  type User
} from 'firebase/auth';
import {
  connectDatabaseEmulator,
  getDatabase,
  goOffline,
  goOnline,
  limitToLast,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  query,
  ref,
  set,
  update,
  type Database
} from 'firebase/database';

/** Maximum number of past dice rolls replayed to a client when it joins. */
const ROLL_HISTORY_LIMIT = 50;
let transportInstanceId = 0;

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
  private sessionGeneration = 0;

  private eventHandlers = new Set<(event: SessionEvent) => void>();
  private activeListeners: Array<() => void> = [];
  private lastKnownTokens = new Map<string, { x: number; y: number }>();
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
      const appName = `vtt-client-${Date.now()}-${++transportInstanceId}`;
      this.app = initializeApp(options.config, appName);
      this.auth = getAuth(this.app);
      this.db = getDatabase(this.app);
    } else if (options.useEmulator) {
      const emulatorConfig: FirebaseTransportConfig = {
        apiKey: 'demo-vtt-key',
        authDomain: 'localhost',
        databaseURL: `http://${host}:${dbPort}/?ns=demo-vtt-default-rtdb`,
        projectId: 'demo-vtt'
      };
      const appName = `vtt-emulator-${Date.now()}-${++transportInstanceId}`;
      this.app = initializeApp(emulatorConfig, appName);
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
      if (this.db && this.currentRoomId && this.currentUser) {
        const tokenRef = ref(this.db, `active_sessions/${this.currentRoomId}/tokens/${tokenId}`);
        this.reportWriteFailure(`token move (${tokenId})`, update(tokenRef, { x, y }));
      } else {
        this.broadcastEvent({ type: 'token:moved', tokenId, x, y });
      }
    }, 100);
  }

  async joinSession(roomId: string, displayName: string, isHost: boolean): Promise<void> {
    const generation = ++this.sessionGeneration;
    this.currentRoomId = roomId;
    this.currentDisplayName = displayName;
    this.currentIsHost = isHost;

    if (!this.auth || !this.db) {
      // In-memory fallback if Firebase credentials are not provided
      this.broadcastEvent({ type: 'session:joined', roomId, displayName, isHost });
      return;
    }

    // 1. Anonymous Authentication (Zero-friction join invariant)
    // Use in-memory persistence so two tabs in the same browser get distinct
    // anonymous UIDs and never overwrite or tear down each other's presence.
    try {
      await setPersistence(this.auth, inMemoryPersistence);
      const userCred = await signInAnonymously(this.auth);
      this.currentUser = userCred.user;
    } catch (err) {
      console.warn('[FirebaseRTDBTransport] Auth/Connection failed, falling back to local session:', err);
      this.broadcastEvent({ type: 'session:joined', roomId, displayName, isHost });
      return;
    }

    if (generation !== this.sessionGeneration) {
      goOffline(this.db);
      return;
    }

    const db = this.db;
    goOnline(db);
    const uid = this.currentUser.uid;
    const sessionRoot = `active_sessions/${roomId}`;

    // 2. Subscribe to live state FIRST, so a rejected write below can never
    //    leave this client deaf to the rest of the table.
    this.subscribeToSession(db, sessionRoot);

    // 3. Register Presence
    const presenceRef = ref(db, `${sessionRoot}/presence/${uid}`);
    try {
      await onDisconnect(presenceRef).remove();
      if (generation !== this.sessionGeneration) {
        goOffline(db);
        return;
      }
      await set(presenceRef, { displayName, isHost, joinedAt: Date.now() });
    } catch (err) {
      console.error('[FirebaseRTDBTransport] Failed to register presence:', err);
    }

    if (generation !== this.sessionGeneration) {
      try {
        await set(presenceRef, null);
      } catch {
        // Ignored during teardown
      }
      goOffline(db);
      return;
    }

    // 4. Claim / refresh Host Meta (if Host). Rejected when another live host owns the room.
    if (isHost) {
      try {
        // Subtract a small buffer so minor client/server clock skew never trips
        // the `expiresAt <= now + 3h` security rule validation.
        await update(ref(db, `${sessionRoot}/meta`), {
          hostUid: uid,
          expiresAt: Date.now() + 3 * 3600 * 1000 - 5000 // 3-hour session window
        });
      } catch (err) {
        console.error(
          `[FirebaseRTDBTransport] Could not claim host of room "${roomId}". ` +
            'Another active host owns it; GM-only writes (fog) will be rejected.',
          err
        );
      }
    }

    this.broadcastEvent({ type: 'session:joined', roomId, displayName, isHost });
  }

  private subscribeToSession(db: Database, sessionRoot: string): void {
    // Live Tokens
    this.lastKnownTokens.clear();
    const unsubscribeTokens = onValue(ref(db, `${sessionRoot}/tokens`), (snapshot) => {
      const val = snapshot.val();
      if (!val) return;
      for (const [tokenId, data] of Object.entries(val)) {
        const token = data as { x: number; y: number };
        if (typeof token.x === 'number' && typeof token.y === 'number') {
          const prev = this.lastKnownTokens.get(tokenId);
          if (prev && prev.x === token.x && prev.y === token.y) {
            continue;
          }
          this.lastKnownTokens.set(tokenId, { x: token.x, y: token.y });
          this.broadcastEvent({ type: 'token:moved', tokenId, x: token.x, y: token.y });
        }
      }
    });
    this.activeListeners.push(unsubscribeTokens);

    // Live Dice Rolls: each roll is delivered exactly once, history replayed on join.
    const rollsQuery = query(ref(db, `${sessionRoot}/rolls`), limitToLast(ROLL_HISTORY_LIMIT));
    const unsubscribeRolls = onChildAdded(rollsQuery, (snapshot) => {
      const roll = snapshot.val() as {
        actor: string;
        expression: string;
        total: number;
        rolls?: number[];
        modifier?: number;
        timestamp: number;
      } | null;
      if (!roll || !roll.timestamp) return;
      this.broadcastEvent({
        type: 'dice:rolled',
        actor: roll.actor,
        result: {
          expression: roll.expression,
          total: roll.total,
          rolls: roll.rolls ?? [roll.total],
          modifier: roll.modifier ?? 0
        },
        timestamp: roll.timestamp
      });
    });
    this.activeListeners.push(unsubscribeRolls);

    // Fog of War: ordered patch log, so late joiners rebuild the full fog state.
    const unsubscribeFog = onChildAdded(ref(db, `${sessionRoot}/fog/patches`), (snapshot) => {
      const val = snapshot.val();
      if (val && Array.isArray(val.rects)) {
        this.broadcastEvent({
          type: 'fog:patched',
          patch: { mode: val.mode === 'hide' ? 'hide' : 'reveal', rects: val.rects }
        });
      }
    });
    this.activeListeners.push(unsubscribeFog);

    // Presence: connected participant count
    const unsubscribePresence = onValue(ref(db, `${sessionRoot}/presence`), (snapshot) => {
      this.broadcastEvent({ type: 'presence:changed', count: snapshot.size });
    });
    this.activeListeners.push(unsubscribePresence);
  }

  async leaveSession(): Promise<void> {
    this.sessionGeneration++;
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
      goOffline(this.db);
    }

    this.broadcastEvent({ type: 'session:left' });
    this.currentRoomId = null;
  }

  emitTokenMove(tokenId: string, x: number, y: number): void {
    this.throttledMove(tokenId, x, y);
  }

  emitDiceRoll(expression: string, result: DiceRollResult): void {
    if (!this.db || !this.currentRoomId || !this.currentUser) {
      this.broadcastEvent({
        type: 'dice:rolled',
        actor: this.currentDisplayName,
        result,
        timestamp: Date.now()
      });
      return;
    }

    const rollsRef = ref(this.db, `active_sessions/${this.currentRoomId}/rolls`);
    this.reportWriteFailure(
      `dice roll (${expression})`,
      push(rollsRef, {
        actor: this.currentDisplayName,
        expression: result.expression,
        total: result.total,
        rolls: result.rolls,
        modifier: result.modifier,
        timestamp: Date.now()
      })
    );
  }

  emitFogPatch(patch: FogPatch): void {
    if (!this.db || !this.currentRoomId || !this.currentUser) {
      this.broadcastEvent({ type: 'fog:patched', patch });
      return;
    }

    const patchesRef = ref(this.db, `active_sessions/${this.currentRoomId}/fog/patches`);
    this.reportWriteFailure('fog patch', push(patchesRef, { mode: patch.mode, rects: patch.rects }));
  }

  onStateEvent(handler: (event: SessionEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /** Surfaces rejected writes (e.g. permission_denied) instead of swallowing them. */
  private reportWriteFailure(action: string, write: PromiseLike<unknown>): void {
    Promise.resolve(write).catch((err: unknown) => {
      console.error(`[FirebaseRTDBTransport] ${action} was rejected by the server:`, err);
    });
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
