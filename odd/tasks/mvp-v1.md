# VTT — MVP v1 Feature Logbook
Objective: Build MVP v1 of the VTT monorepo following ARCHITECTURE.md (Tauri v2 + Svelte 5 + Pixi.js v8 + Firebase RTDB Spark).
Branch: feat/mvp-v1 | Delivery Strategy: ask-on-risk | Test Runner: vitest

## Specs

- **S1 — Workspace & Apple-Style UI Shell:** Initialize project named "VTT" with monorepo structure (`packages/core`, `packages/ui`, `packages/adapters`, `apps/web`, `apps/desktop`), strict `NetworkTransport` and `AssetProvider` contracts, and a clean, minimalist Apple-inspired UI shell ("el diseño visual me gustaria que fuera llamativo pero simple un poco siguiendo la idea de apel del diseño", translucent `backdrop-blur` surfaces, 1px hairline borders, floating toolbar, collapsible drawer).
  - Checks: `vitest` unit tests pass on core contracts/throttling/providers; `vite build` succeeds cleanly for `apps/web`; UI renders cleanly in browser with zero runtime console errors.
- **S2 — Hardware-Accelerated Board (Pixi.js v8):** Pan/zoom viewport, configurable square/hex grid, snap-to-grid tokens, and distance ruler.
- **S3 — Firebase Transport & Local Cache (Spark):** `FirebaseRTDBTransport` (Anonymous Auth join, presence, 10 Hz throttled token sync, 60 FPS lerp) + `Dexie.js` IndexedDB asset caching + `SparkAssetProvider`.
- **S4 — GM Tools & Dice:** Manual Fog of War brush/rectangle, safe dice expression roller, compact roll/chat drawer.
- **S5 — Custom Sheet Engine:** Declarative CSB-inspired JSON sheet renderer + safe expression evaluator (no `eval()`).
- **S6 — Tauri Persistence & Time Guardrail:** Local campaign save/load in Tauri + `expiresAt` RTDB security rules enforcement (`database.rules.json`).

## Tasks

- [x] **T1** (S1) — Route: `inline` — Scaffold monorepo, core adapter interfaces, throttle utility, `SparkAssetProvider`, Apple-style Svelte 5 + Tailwind UI shell, `apps/web` Vite app, and `apps/desktop` Tauri v2 template. | Status: done | Commit: `58f8dd1` (vitest: 6/6 passed, svelte-check: 0 errors, vite build: 24.63 kB gzip JS, Playwright: 0 console errors; Tauri native build pending Rust install)
- [x] **T2** (S2) — Route: `inline` — Implement Pixi.js v8 viewport, grid, tokens, and ruler. | Status: done | Commit: `d39206b` (vitest: 11/11 passed, svelte-check: 0 errors, vite build: 358.25 kB JS, Playwright E2E verified live canvas + tokens + ruler)
- [x] **T3** (S3) — Route: `inline` — Implement Firebase RTDB transport, Anonymous Auth, 10 Hz sync + lerp, and Dexie cache. | Status: done | Commit: `da8189f` (vitest: 20/20 passed, svelte-check: 0 errors, vite build: clean, Playwright E2E verified)
- [x] **T4** (S4) — Route: `inline` — Implement manual Fog of War, dice roller, and chat log. | Status: done | Commit: `58d292f` (vitest: 25/25 passed, svelte-check: 0 errors, vite build: clean, Playwright E2E verified)
- [x] **T5** (S5) — Route: `inline` — Implement declarative JSON sheet renderer and safe formula parser. | Status: done | Commit: pending (vitest: 29/29 passed, svelte-check: 0 errors, vite build: clean, Playwright E2E verified)
- [ ] **T6** (S6) — Route: `inline` — Implement Tauri local storage commands and RTDB `database.rules.json` session expiration. | Status: pending

## Log

- **L1 (Original Request):** User requested building a lightweight, fast, system-agnostic VTT combining Foundry-style local GM hosting with Roll20-style zero-friction browser join inside the Google/Firebase ecosystem: "quiero que la app sea ligera y rapida en todo sentido y que sea estable la idea es que la usabilidad sea supeior a cualquier competencia del mercado... me gustaria que fuera llamativo pero simple un poco siguiendo la idea de apel del diseño".
- **L2 (MVP Scope Decisions):**
  - "vamos por algo agnostico y ademas una estructura base para poder crear sistemas custom" (CSB-inspired declarative JSON sheets).
  - "vamos por el mvp ultra enfocado para luego hacer el resto de sistemas".
  - "vamos a comensar por lo minimo la app de tauri y dado que los primero usuarios no van a pagar porque solo probaran" (Tauri-only GM in v1, Web-only players).
  - Confirmed strict Spark plan (no credit card) for Beta via `SparkAssetProvider` ("si").
  - Voice/Video excluded ("dejemoslo fuera").
  - Project named "VTT" and authorized Slice 1 start.
- **L3 (Environment Discovery & Engram Note):** Toolchain check showed Node `v22.23.4`, npm `10.9.9`, Git `2.56.0`, and **no Rust/Cargo installed yet** (`apps/desktop` native compilation requires installing Rust via `rustup` + WebView2). Engram mirror is marked pending until user sets `C:\Users\malon\.gemini\antigravity\scratch\VTT` as active workspace.
- **L4 (Slice 1 Verification — T1):**
  - RED: `vitest run` failed 3/3 test suites before implementation.
  - GREEN: `vitest run` passed 3/3 suites (6/6 tests); `svelte-check` 0 errors/warnings; `vite build` produced 24.63 kB gzipped JS; Playwright rendered UI with 0 console errors and verified live `d20` roll.
  - Pending external check: Native Rust compilation of `apps/desktop` awaits Rust toolchain (`rustup`). Risk: none.
- **L5 (Slice 2 Authorization — T2):** User authorized setting up Engram and proceeding with T2: "primero dejemos todo listo para emgram dado que es indispensable para la claridad del proyecto y luego has el siguiente paso que me sugeriste". Configured `.engram/config.json` with `project_name: "vtt"` and registered active session `c01f2d70-dbdc-40ab-a697-74822fb8a302`. Engram mirror active. Proceeding with T2.
- **L6 (Slice 2 Verification — T2):**
  - RED: `vitest run` failed before `packages/core/src/grid.ts` implementation (missing module).
  - GREEN: `vitest run` passed 4/4 suites (11/11 tests, +5 tests for square/hex grid coordinate conversion, snapping, and Chebyshev/hex distance).
  - Types: `svelte-check` reported 0 errors, 0 warnings across the workspace.
  - Production Build: `vite build` cleanly bundled Pixi.js v8 + Svelte 5 + Tailwind in 3.49s.
  - E2E Validation: Navigated with Playwright to `http://localhost:5173/`, verified hardware-accelerated WebGL canvas mount, rendered tokens with HP indicators, switched tools to Measure/Ruler, executed interactive drag measurement (60 ft, glowing reticle + distance badge), captured screenshots `vtt-board-live` and `vtt-ruler-live`. Risk: none.
- **L7 (Slice 3 Verification — T3):**
  - Dependencies: Installed `firebase` and `dexie` in `@vtt/adapters`.
  - Core: Implemented `packages/core/src/lerp.ts` (`lerp`, `lerpPoint`, `expDecay`, `expDecayPoint`) with 4 deterministic unit tests in `packages/core/tests/lerp.test.ts`.
  - Adapters: Implemented `FirebaseRTDBTransport` (`packages/adapters/src/firebase-rtdb-transport.ts`) with anonymous authentication, presence tracking, 10 Hz throttled token sync, and modular event listeners; implemented `CachedAssetProvider` and `DexieAssetCache` (`packages/adapters/src/cached-asset-provider.ts`, `dexie-asset-cache.ts`) enforcing Invariant #5 (local cache by content hash before network).
  - Web: Updated `apps/web/src/App.svelte` to parse URL room code / host parameters and use `CachedAssetProvider`.
  - Verification: `vitest` passes 7/7 suites (20/20 tests, +9 tests for lerp, cached provider, and Firebase transport); `svelte-check` reports 0 errors/warnings; `vite build` succeeds; Playwright verified room routing and UI mount. Risk: none.
- **L8 (Slice 4 Verification — T4):**
  - Core: Implemented `packages/core/src/dice.ts` with `parseAndRollDice` safely evaluating tabletop expressions (`1d20+5`, `4d6kh3`, `2d20kl1`, etc.) without `eval()`, protected by count/sides bounds; 5 deterministic unit tests in `packages/core/tests/dice.test.ts`.
  - Board Engine: Integrated `fogLayer` and `fogPreviewLayer` in `BoardEngine` with interactive rectangle drag for GM (`activeTool === 'fog'`), semi-transparent shroud for GM (alpha 0.55) and opaque for players (alpha 0.98), dispatching `onFogPatch` (`FogPatch`).
  - UI: Updated `BoardCanvas.svelte` to bind `isHost`, emit fog patches, and react to remote `fog:patched` events; updated `SideDrawer.svelte` with custom formula input bar and dice history log; wired `VttShell.svelte` to `parseAndRollDice`.
  - Verification: `vitest` passes 8/8 suites (25/25 tests); `svelte-check` reports 0 errors/warnings; `vite build` succeeds; Playwright verified live `4d6kh3` roll ($6+3+3=12$) and GM Fog rectangle creation. Risk: none.
- **L9 (Slice 5 Verification — T5):**
  - Core: Implemented `packages/core/src/sheet.ts` providing `evaluateFormula` (Shunting-yard RPN math evaluator without `eval()`), `evaluateSheet` (multi-pass dependency resolution for computed fields), and `resolveActionRoll` (replaces attribute keys and normalizes arithmetic signs); added 4 deterministic unit tests in `packages/core/tests/sheet.test.ts`.
  - Dice: Enhanced `packages/core/src/dice.ts` to support chained multiple modifiers (e.g. `1d20+3+2`).
  - UI: Built `packages/ui/src/CustomSheet.svelte` (Apple-style vitals HP/AC/INIT, attribute steppers, and interactive action buttons); mounted inside `SideDrawer.svelte` under the `Sheet` tab.
  - Verification: `vitest` passes 9/9 suites (29/29 tests); `svelte-check` reports 0 errors/warnings; `vite build` succeeds; Playwright verified live character sheet rendering, interactive action click ("Longsword Strike" $\rightarrow$ `1d20+3+2`), and roll resolution in the live feed. Risk: none.
