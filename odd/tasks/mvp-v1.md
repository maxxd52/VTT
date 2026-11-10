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
- [ ] **T2** (S2) — Route: `inline` — Implement Pixi.js v8 viewport, grid, tokens, and ruler. | Status: pending
- [ ] **T3** (S3) — Route: `inline` — Implement Firebase RTDB transport, Anonymous Auth, 10 Hz sync + lerp, and Dexie cache. | Status: pending
- [ ] **T4** (S4) — Route: `inline` — Implement manual Fog of War, dice roller, and chat log. | Status: pending
- [ ] **T5** (S5) — Route: `inline` — Implement declarative JSON sheet renderer and safe formula parser. | Status: pending
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
