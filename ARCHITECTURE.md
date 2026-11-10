# Virtual Tabletop (VTT) — Architecture & MVP Specification

**Status:** Approved Foundation (MVP v1 Locked)  
**Primary Goal:** Combine the local-first ownership and power of Foundry VTT with the zero-friction browser simplicity of Roll20, wrapped in a fast, Apple-inspired minimalist interface—operated entirely within the Google/Firebase ecosystem at near-zero baseline cost.

---

## 1. Strategic Decisions & Rationale

| Area | Decision | Why (Rationale & Tradeoffs) |
| :--- | :--- | :--- |
| **Core Architecture** | **Firebase Serverless (Option 2)** with future WebRTC Adapter | Eliminates NAT/CGNAT traversal failures, port-forwarding barriers, and custom backend/Docker maintenance while keeping operating costs near \$0 under free quotas. |
| **Network Abstraction** | **Adapter Pattern** (`NetworkTransport` interface) | Decouples the board engine from Firebase RTDB. Enables plugging in a `WebRTCTransport` (P2P with RTDB fallback) at scale without rewriting any game or UI logic. |
| **Asset Abstraction** | **Adapter Pattern** (`AssetProvider` interface) | Decouples map/token resolution from storage backend. Allows Spark-compatible static/URL assets in Beta (`SparkAssetProvider`) and seamless swap to Cloud Storage (`FirebaseStorageProvider`) on Blaze later. |
| **Live Sync Engine** | **Firebase Realtime Database (RTDB)** | Bills by downloaded GB (\$1/GB after 10 GB free), NOT per operation. Supports 200k simultaneous connections/shard and native presence (`.info/connected`). |
| **Business / Auth DB** | **Cloud Firestore** (Idle state & metadata only) | Ideal for structured queries (user profiles, licenses, modules, saved cloud campaigns). **Never** used for live token dragging due to per-write pricing. |
| **Asset Storage** | **Cloud Storage for Firebase + `IndexedDB`** | Cheap persistent storage (\$0.026/GB/mo) paired with browser local caching (`Dexie.js`) keyed by file hash so assets download once per campaign. |
| **Desktop Host (DM)** | **Tauri v2** (Rust + WebView) | ~12 MB binary, ~35–40 MB RAM (vs ~150 MB / ~500 MB in Electron). Grants native filesystem access so one-time buyers store campaigns locally at \$0 cloud cost. |
| **Web & UI Layer** | **Svelte 5** (Runes) + **Tailwind CSS** | Compiles to minimal vanilla JS (<30 KB) with no Virtual DOM overhead. Instant player load times and smooth 60 FPS glassmorphic/Apple-style UI. |
| **2D Board Engine** | **Pixi.js v8** (WebGL / WebGPU) | Hardware-accelerated canvas capable of rendering 4K/8K battlemaps, grids, tokens, and fog of war at 60–120 FPS. |

---

## 2. Three-Plane Data Architecture

The system strictly isolates traffic by payload size and frequency so free/low-cost quotas remain sustainable:

```text
[ Client: Tauri Desktop (DM) / Web Browser (Players) ]
   │
   ├── 1. STATIC PLANE (Heavy Binaries: Maps, Tokens, Audio)
   │      └── Cloud Storage ──(download once)──> IndexedDB (SHA-256 cached)
   │
   ├── 2. DYNAMIC PLANE (Live Ephemeral State: X/Y, Dice, Chat, Presence)
   │      └── Firebase RTDB (/active_sessions/{roomId})
   │          • Push-only WebSockets (0 bytes transmitted when idle)
   │          • 10 Hz max drag throttling + 60 FPS client lerp interpolation
   │
   └── 3. PERSISTENCE PLANE (Accounts, Licenses, Cloud Campaigns)
          └── Cloud Firestore (Low-frequency reads/writes)
```

### Synchronization & Network Rules
1. **Push, Never Polling:** Clients subscribe to RTDB nodes via WebSockets. Roleplay pauses consume **0 bytes**.
2. **Throttled Delta Updates:** Mouse drag events (60–144 Hz) are throttled locally to emit at most **once every 100 ms (10 Hz)** with minimal keys (e.g., `{"x":140,"y":80}`). Receiving clients interpolate smoothly at 60 FPS.
3. **DM Authority & Local Save:** During live play, the DM client arbitrates state conflicts. When the session ends, the final snapshot is saved locally (or to Cloud Plus) and the ephemeral RTDB node is purged.
4. **Zero-Friction Player Join:** Players join via a short invite link using Firebase **Anonymous Auth** (`signInAnonymously`) + display name—no mandatory account creation.

---

## 3. Business Model & Unit Economics

| Tier | Target User | Storage Location | Infrastructure Cost to Platform |
| :--- | :--- | :--- | :--- |
| **Free Trial** | New GMs testing the VTT | Ephemeral / Local only | **\$0** (Session time-capped via RTDB security rules, e.g., 2–3h max) |
| **One-Time Purchase** | GMs running live hosted tables | GM's local hard drive (Tauri) | **~\$0** (~2.5 MB RTDB egress per 3h 5-player session $\approx$ 4,000 sessions inside 10 GB free tier; \$0.0025/session thereafter) |
| **Cloud Plus (Sub)** | GMs wanting *Always-On* access | Cloud Storage + Firestore | **~\$0.26/mo** per 10 GB stored + minimal cached egress (85–90% gross margin at \$4–\$5/mo pricing) |

### Quota & Billing Boundaries
* **Spark Plan (No-Card Free Tier):** Supports up to **100 simultaneous RTDB connections** (~20 concurrent 5-player tables at the exact same second, or ~100 tables across staggered schedules), **10 GB/mo RTDB egress**, and Firebase Hosting (`10 GB/mo`). *Important:* On new Firebase projects, **Cloud Storage buckets require enabling the Blaze plan** (only older legacy projects retain Spark Storage access).
* **Blaze Plan (Pay-as-you-go):** Retains all free quotas (including 5 GB Storage + 1 GB/day Storage egress + 10 GB/mo RTDB egress at \$0) while unlocking **200,000 simultaneous connections** per RTDB instance and Cloud Storage buckets.
* **Mandatory Financial Guardrail:** Blaze has no native hard spending cap. Before public launch, deploy a programmatic budget cutoff (Google Cloud Budgets $\rightarrow$ Pub/Sub $\rightarrow$ Cloud Function) to prevent runaway billing from bugs or abuse.

---

## 4. Non-Negotiable Architectural Invariants (For AI Agents)

> [!IMPORTANT]
> Any agent, contributor, or code generator working on this codebase MUST preserve these invariants unless explicitly overridden by an architectural ADR.

- [ ] **Never use Firestore for real-time board events** (token dragging, cursor tracking, ping coordinates, or live chat).
- [ ] **Never store binary assets or Base64 images in RTDB.** RTDB holds strictly lightweight JSON deltas and session pointers.
- [ ] **Enforce the `NetworkTransport` and `AssetProvider` interfaces.** Pixi.js board logic and Svelte UI stores must never import Firebase SDK methods directly.
- [ ] **Keep network payloads minimal and throttled.** Continuous pointer/drag updates must never exceed 10 emits/sec (`100ms` interval).
- [ ] **Cache all remote assets locally.** Every Cloud Storage download must check `Dexie.js` (`IndexedDB`) by content hash before hitting the network.
- [ ] **Protect player onboarding.** Never gate joining a table behind email/password sign-up forms.
- [ ] **Design System Consistency.** Follow Apple-inspired minimalism: generous whitespace, crisp typography (Inter/Geist), subtle `1px` borders, translucent panels (`backdrop-blur`), and progressive disclosure (hide advanced GM tools until needed).

---

## 5. MVP & Design Decisions

### Resolved
1. **Rule System Scope (`[DECIDED]`):** **System-Agnostic Core + Declarative Custom System Builder** (inspired by Foundry VTT's *Custom System Builder* / legacy *Sandbox*).
   - *Architectural implication:* The engine stays lean and system-agnostic. Character sheets, attributes, computed modifiers, and roll buttons are driven by **declarative JSON templates** rendered natively by Svelte components and evaluated via a **safe expression parser** (never `eval()` or arbitrary user JS, ensuring security and effortless Firebase sync).
2. **Core MVP Feature Set (`[DECIDED]`):** **Ultra-Focused V1 Core** (Fast time-to-market).
   - *Included in MVP v1:* Battlemaps with configurable grid & measurement ruler, drag-and-drop tokens (with basic HP/aura badges), simple manual Fog of War (brush/rectangle reveal), dice roller + compact chat log, and JSON-template custom character sheets (community/GM edits JSON or picks presets).
   - *Deferred to Phase 2:* Dynamic Lighting (walls/raycasting/line-of-sight) and Visual Drag-and-Drop Sheet Builder UI.
3. **GM Platform Parity (`[DECIDED]`):** **Tauri Desktop-only for GMs in MVP v1; Web-only for Players.**
   - *Architectural implication:* Zero Cloud Plus persistence needed for the beta launch. All campaign creation, local saves, and GM controls live natively in the Tauri desktop app, keeping beta storage costs at \$0. Browser-based GM hosting (*Always-On* Cloud Plus) rolls out in Phase 2.
4. **Custom Map Delivery in Beta/MVP (`[DECIDED]`):** **Strict Spark Plan (No Card) via `SparkAssetProvider`.**
   - *Architectural implication:* Beta uses bundled maps/tokens served statically from Firebase Hosting (10 GB/mo free) and external image URLs. Upon moving to Blaze in production, swap in `FirebaseStorageProvider` (~50 lines) for Tauri-side WebP compression and ephemeral Cloud Storage uploads.
5. **Voice & Video (`[DECIDED]`):** **Explicitly Out of Scope.**
   - *Architectural implication:* Players use external voice tools (e.g., Discord). Keeps TURN/media infrastructure costs at \$0, eliminates browser WebRTC media failures, and dedicates 100% of device CPU/RAM to 60–120 FPS board rendering.

---

## 6. Core Contracts & Schemas (Agent Implementation Reference)

### A. Monorepo Topology (Shared Engine, Dual Targets)
```text
/
├── packages/
│   ├── core/          # Pixi.js v8 board engine, math, grid, Fog of War, safe formula parser
│   ├── ui/            # Svelte 5 + Tailwind Apple-style glassmorphic components & sheet renderer
│   └── adapters/      # NetworkTransport (FirebaseRTDBTransport) & AssetProvider (SparkAssetProvider)
├── apps/
│   ├── desktop/       # Tauri v2 (Rust) host app for GMs (local campaign files & session control)
│   └── web/           # Lightweight Svelte SPA deployed to Firebase Hosting for Players
└── firebase/
    └── database.rules.json
```

### B. Adapter Interfaces (Enforced Boundaries)
```typescript
export interface NetworkTransport {
  joinSession(roomId: string, displayName: string, isHost: boolean): Promise<void>;
  leaveSession(): Promise<void>;
  emitTokenMove(tokenId: string, x: number, y: number): void; // Must throttle <= 10 Hz
  emitDiceRoll(expression: string, result: DiceRollResult): void;
  emitFogPatch(patch: FogPatch): void;
  onStateEvent(handler: (event: SessionEvent) => void): () => void;
}

export interface AssetProvider {
  resolveAssetUrl(assetIdOrUrl: string): Promise<{ url: string; hash: string }>;
  // Phase 2 Blaze extension: uploadAsset(file: File | Uint8Array): Promise<AssetRef>;
}
```

### C. Ephemeral RTDB Session Schema (`/active_sessions/{roomId}`)
Keep keys short to minimize RTDB egress (~2.5 MB per 3-hour 5-player game):
```json
{
  "meta": {
    "hostUid": "uid_dm_123",
    "expiresAt": 1731234000000,
    "mapUrl": "/assets/maps/crypt.webp",
    "grid": { "size": 70, "type": "square" }
  },
  "tokens": {
    "t1": { "x": 140, "y": 210, "img": "/assets/tokens/hero.webp", "n": "Aragorn", "hp": [24, 30] }
  },
  "fog": { "rects": [[0, 0, 700, 700]] },
  "rolls": {
    "-PushId1": { "u": "Aragorn", "e": "1d20+5", "v": 19, "ts": 1731230100 }
  }
}
```
*Security Rules Rule-of-Thumb:* Only `auth.uid === meta.hostUid` can mutate `meta` and `fog`, and all writes require `now < meta.expiresAt` (enforcing free-tier time limits server-side).

### D. Declarative Custom Sheet Schema (CSB-Inspired)
Sheets are data-only JSON templates evaluated via a sandboxed math/dice expression parser (no `eval()`):
```json
{
  "systemId": "custom-d20-lite",
  "fields": [
    { "key": "str", "label": "Strength", "type": "number", "default": 10 },
    { "key": "strMod", "label": "STR Mod", "type": "computed", "formula": "floor((str - 10) / 2)" }
  ],
  "actions": [
    { "label": "Melee Attack", "roll": "1d20 + strMod" }
  ]
}
```

---

## 7. MVP v1 Build Roadmap (Iterative Slices)

1. **Slice 1 — Workspace & Apple-Style UI Shell:** Initialize monorepo (`Tauri v2` + `Svelte 5` + `Tailwind CSS`), establish translucent design tokens (`backdrop-blur`, hairline borders, Inter/Geist font).
2. **Slice 2 — Hardware-Accelerated Board (`Pixi.js v8`):** Pan/zoom viewport, configurable square/hex grid, snap-to-grid tokens, and distance ruler.
3. **Slice 3 — Firebase Transport & Local Cache (`Spark`):** Connect `FirebaseRTDBTransport` (Auth anonymous join, presence, 10 Hz throttled token sync, 60 FPS lerp) + `Dexie.js` asset caching.
4. **Slice 4 — GM Tools & Dice:** Manual Fog of War brush/rectangle, safe dice expression roller, compact roll/chat drawer.
5. **Slice 5 — Custom Sheet Engine:** Declarative JSON sheet renderer + safe formula evaluator.
6. **Slice 6 — Tauri Persistence & Time Guardrail:** Local JSON/SQLite save/load in Tauri + `expiresAt` RTDB security rules enforcement.
