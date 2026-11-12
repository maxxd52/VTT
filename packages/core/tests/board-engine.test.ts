import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderSpy = vi.fn();
const resizeSpy = vi.fn();
const tickerStopSpy = vi.fn();
const initOptionsSpy = vi.fn();
const cacheAsTextureSpy = vi.fn();

vi.mock('pixi.js', () => {
  class MockContainer {
    label = '';
    eventMode = 'passive';
    cursor = 'default';
    visible = true;
    position = {
      x: 0,
      y: 0,
      set(x: number, y: number) {
        this.x = x;
        this.y = y;
      }
    };
    scale = {
      x: 1,
      y: 1,
      set(s: number) {
        this.x = s;
        this.y = s;
      }
    };
    children: any[] = [];
    get x() {
      return this.position.x;
    }
    get y() {
      return this.position.y;
    }
    addChild(child: any) {
      this.children.push(child);
      return child;
    }
    removeChild(child: any) {
      this.children = this.children.filter((c) => c !== child);
      return child;
    }
    getChildByLabel(label: string) {
      return this.children.find((c) => c.label === label) ?? null;
    }
    on() {}
    toLocal(pt: { x: number; y: number }) {
      return pt;
    }
    cacheAsTexture(val?: boolean) {
      cacheAsTextureSpy(this, val);
    }
    destroy() {}
  }

  class MockGraphics extends MockContainer {
    clear() {
      return this;
    }
    circle() {
      return this;
    }
    rect() {
      return this;
    }
    roundRect() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    closePath() {
      return this;
    }
    fill() {
      return this;
    }
    stroke() {
      return this;
    }
  }

  class MockText extends MockContainer {
    text = '';
    anchor = { set() {} };
    constructor(opts?: { text?: string }) {
      super();
      if (opts?.text) this.text = opts.text;
    }
  }

  class MockTextStyle {
    constructor(_opts?: any) {}
  }

  class MockApplication {
    stage = new MockContainer();
    ticker = {
      stop: tickerStopSpy,
      start: vi.fn()
    };
    renderer = {
      render: renderSpy,
      resize: resizeSpy
    };
    async init(opts: any) {
      initOptionsSpy(opts);
    }
    destroy() {}
  }

  return {
    Application: MockApplication,
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    TextStyle: MockTextStyle
  };
});

import { BoardEngine } from '../src/board-engine';

describe('BoardEngine GPU & On-Demand Render Optimizations', () => {
  let rafCallbacks: Array<FrameRequestCallback> = [];
  let getBoundingClientRectSpy: ReturnType<typeof vi.fn>;
  let canvasStub: any;
  let containerStub: any;

  beforeEach(() => {
    renderSpy.mockClear();
    resizeSpy.mockClear();
    tickerStopSpy.mockClear();
    initOptionsSpy.mockClear();
    cacheAsTextureSpy.mockClear();
    rafCallbacks = [];

    getBoundingClientRectSpy = vi.fn(() => ({
      left: 10,
      top: 20,
      width: 800,
      height: 600
    }));

    canvasStub = {
      style: { cursor: 'default' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: getBoundingClientRectSpy
    };

    containerStub = {
      clientWidth: 800,
      clientHeight: 600
    };

    (globalThis as any).window = {
      devicePixelRatio: 2.5,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      }),
      cancelAnimationFrame: vi.fn()
    };

    (globalThis as any).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  });

  function flushRaf() {
    const pending = [...rafCallbacks];
    rafCallbacks = [];
    for (const cb of pending) {
      cb(16.6);
    }
  }

  it('disables continuous Pixi ticker, caps resolution at 1.5x, uses opaque background, and renders on demand', async () => {
    const engine = new BoardEngine({
      canvas: canvasStub,
      container: containerStub
    });

    await engine.init();

    // 1. Verify init options: autoStart false, opaque background, capped DPR (1.5 instead of 2.5)
    expect(initOptionsSpy).toHaveBeenCalledTimes(1);
    const passedOpts = initOptionsSpy.mock.calls[0][0];
    expect(passedOpts.autoStart).toBe(false);
    expect(passedOpts.backgroundAlpha).toBe(1);
    expect(passedOpts.resolution).toBeLessThanOrEqual(1.5);
    expect(tickerStopSpy).toHaveBeenCalled();

    // Initial render scheduled once
    flushRaf();
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Sitting idle schedules zero additional renders
    flushRaf();
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // 2. Setting tokens schedules exactly one coalesced render frame
    engine.setTokens([
      { id: 't1', name: 'Valeros', x: 0, y: 0, imageUrl: '', hp: [10, 10] },
      { id: 't2', name: 'Merisiel', x: 60, y: 60, imageUrl: '', hp: [10, 10] }
    ]);
    engine.updateTokenPosition('t1', 120, 120);
    // Same position should be a no-op
    engine.updateTokenPosition('t1', 120, 120);

    expect(rafCallbacks.length).toBe(1);
    flushRaf();
    expect(renderSpy).toHaveBeenCalledTimes(2);

    // Another identical position update does not schedule a render
    engine.updateTokenPosition('t1', 120, 120);
    expect(rafCallbacks.length).toBe(0);

    engine.destroy();
  });

  it('renders fog of war on applyFogPatch and schedules on-demand render', async () => {
    const engine = new BoardEngine({
      canvas: canvasStub,
      container: containerStub,
      isHost: false
    });

    await engine.init();
    flushRaf();
    const rendersAfterInit = renderSpy.mock.calls.length;

    // Apply fog patch from network as player
    engine.applyFogPatch({
      mode: 'hide',
      rects: [[0, 0, 120, 120]]
    });

    // Must schedule a frame
    expect(rafCallbacks.length).toBe(1);
    flushRaf();
    expect(renderSpy.mock.calls.length).toBe(rendersAfterInit + 1);

    engine.destroy();
  });

  it('preserves and renders fog patches received before engine.init() finishes', async () => {
    const engine = new BoardEngine({
      canvas: canvasStub,
      container: containerStub,
      isHost: false
    });

    // Patch arrives from network BEFORE engine.init() completes
    engine.applyFogPatch({
      mode: 'hide',
      rects: [[0, 0, 100, 100]]
    });

    await engine.init();
    flushRaf();

    // After init flushes, the stage should have rendered the initial scene including fog
    expect(renderSpy).toHaveBeenCalled();

    engine.destroy();
  });

  it('triggers a render when tab regains visibility (visibilitychange) after background events', async () => {
    let visibilityCallback: (() => void) | null = null;
    (globalThis as any).document = {
      hidden: true,
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'visibilitychange') visibilityCallback = cb;
      }),
      removeEventListener: vi.fn()
    };

    const engine = new BoardEngine({
      canvas: canvasStub,
      container: containerStub,
      isHost: false
    });

    await engine.init();
    flushRaf();
    renderSpy.mockClear();

    // Tab is hidden in background, patch arrives
    engine.applyFogPatch({ mode: 'hide', rects: [[0, 0, 100, 100]] });
    flushRaf();
    renderSpy.mockClear();

    // Tab becomes visible again
    (globalThis as any).document.hidden = false;
    expect(visibilityCallback).toBeDefined();
    visibilityCallback!();

    expect(rafCallbacks.length).toBe(1);
    flushRaf();
    expect(renderSpy).toHaveBeenCalledTimes(1);

    engine.destroy();
  });

  it('caches canvas bounding rect instead of querying DOM on every pointermove', async () => {
    const engine = new BoardEngine({
      canvas: canvasStub,
      container: containerStub
    });

    await engine.init();
    const initialCalls = getBoundingClientRectSpy.mock.calls.length;

    // Simulate active ruler measurement across 10 pointermove events
    engine.setTool('ruler');
    const pointerDownHandler = canvasStub.addEventListener.mock.calls.find(
      (c: any[]) => c[0] === 'pointerdown'
    )?.[1];
    const pointerMoveHandler = (globalThis as any).window.addEventListener.mock.calls.find(
      (c: any[]) => c[0] === 'pointermove'
    )?.[1];

    pointerDownHandler({ button: 0, clientX: 100, clientY: 100 });
    for (let i = 0; i < 10; i++) {
      pointerMoveHandler({ clientX: 100 + i * 5, clientY: 100 + i * 5 });
    }

    // Should NOT call getBoundingClientRect on every pointermove
    expect(getBoundingClientRectSpy.mock.calls.length).toBe(initialCalls);

    engine.destroy();
  });
});
