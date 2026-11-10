import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle
} from 'pixi.js';
import type { GridConfig, TokenState, ToolMode } from './contracts';
import { calculateDistance, snapToGrid } from './grid';

export interface BoardEngineOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  grid?: GridConfig;
  onTokenMove?: (tokenId: string, x: number, y: number) => void;
  onTokenMoveEnd?: (tokenId: string, x: number, y: number) => void;
}

export class BoardEngine {
  private app: Application | null = null;
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;

  private world = new Container();
  private mapLayer = new Graphics();
  private gridLayer = new Graphics();
  private tokenLayer = new Container();
  private rulerLayer = new Graphics();
  private rulerLabel: Text | null = null;

  private gridConfig: GridConfig = { size: 60, type: 'square' };
  private activeTool: ToolMode = 'select';

  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private worldStart = { x: 0, y: 0 };

  private isSpacePressed = false;

  private isMeasuring = false;
  private rulerStart = { x: 0, y: 0 };

  private tokens = new Map<string, Container>();
  private draggedToken: { id: string; container: Container; offset: { x: number; y: number } } | null = null;

  private onTokenMove?: (tokenId: string, x: number, y: number) => void;
  private onTokenMoveEnd?: (tokenId: string, x: number, y: number) => void;

  private resizeObserver: ResizeObserver | null = null;
  private boundOnWheel: (e: WheelEvent) => void;
  private boundOnPointerDown: (e: PointerEvent) => void;
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: (e: PointerEvent) => void;
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;

  constructor(options: BoardEngineOptions) {
    this.canvas = options.canvas;
    this.container = options.container;
    if (options.grid) {
      this.gridConfig = options.grid;
    }
    this.onTokenMove = options.onTokenMove;
    this.onTokenMoveEnd = options.onTokenMoveEnd;

    this.boundOnWheel = this.handleWheel.bind(this);
    this.boundOnPointerDown = this.handlePointerDown.bind(this);
    this.boundOnPointerMove = this.handlePointerMove.bind(this);
    this.boundOnPointerUp = this.handlePointerUp.bind(this);
    this.boundOnKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') this.isSpacePressed = true;
    };
    this.boundOnKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') this.isSpacePressed = false;
    };
  }

  public async init(): Promise<void> {
    const app = new Application();
    await app.init({
      canvas: this.canvas,
      resizeTo: this.container,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    });

    this.app = app;
    this.app.stage.addChild(this.world);

    this.world.addChild(this.mapLayer);
    this.world.addChild(this.gridLayer);
    this.world.addChild(this.tokenLayer);
    this.world.addChild(this.rulerLayer);

    const labelStyle = new TextStyle({
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 12,
      fill: '#ffffff',
      fontWeight: '600'
    });
    this.rulerLabel = new Text({ text: '', style: labelStyle });
    this.rulerLabel.visible = false;
    this.world.addChild(this.rulerLabel);

    // Initial center position
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.world.position.set(width / 2, height / 2);

    this.renderDefaultMap();
    this.renderGrid();

    // Event listeners
    this.canvas.addEventListener('wheel', this.boundOnWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', this.boundOnPointerDown);
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
    window.addEventListener('keydown', this.boundOnKeyDown);
    window.addEventListener('keyup', this.boundOnKeyUp);

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.container);
  }

  public setTool(tool: ToolMode): void {
    this.activeTool = tool;
    if (tool !== 'ruler') {
      this.clearRuler();
    }
  }

  public setGridConfig(config: GridConfig): void {
    this.gridConfig = config;
    this.renderGrid();
  }

  public setTokens(tokenStates: TokenState[]): void {
    const currentIds = new Set(tokenStates.map((t) => t.id));

    // Remove deleted tokens
    for (const [id, container] of this.tokens.entries()) {
      if (!currentIds.has(id)) {
        this.tokenLayer.removeChild(container);
        container.destroy({ children: true });
        this.tokens.delete(id);
      }
    }

    // Add or update tokens
    for (const token of tokenStates) {
      this.upsertToken(token);
    }
  }

  public updateTokenPosition(id: string, x: number, y: number): void {
    const container = this.tokens.get(id);
    if (!container) return;
    if (this.draggedToken?.id === id) return; // Do not overwrite active drag preview
    container.position.set(x, y);
  }

  private upsertToken(token: TokenState): void {
    let container = this.tokens.get(token.id);

    if (!container) {
      container = new Container();
      container.label = token.id;
      container.eventMode = 'static';
      container.cursor = 'grab';

      // Outer glow / selection ring
      const ring = new Graphics();
      ring.label = 'ring';
      container.addChild(ring);

      // Token Body Circle
      const body = new Graphics();
      body.label = 'body';
      container.addChild(body);

      // Initial label
      const initialStyle = new TextStyle({
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#ffffff'
      });
      const initialText = new Text({
        text: token.name.slice(0, 2).toUpperCase(),
        style: initialStyle
      });
      initialText.label = 'label';
      initialText.anchor.set(0.5);
      container.addChild(initialText);

      // HP Bar Indicator
      const hpBar = new Graphics();
      hpBar.label = 'hpBar';
      container.addChild(hpBar);

      // Token drag handler
      const targetContainer = container;
      targetContainer.on('pointerdown', (event) => {
        if (this.activeTool !== 'select') return;
        event.stopPropagation();

        const localPos = this.world.toLocal(event.global);
        this.draggedToken = {
          id: token.id,
          container: targetContainer,
          offset: {
            x: localPos.x - targetContainer.position.x,
            y: localPos.y - targetContainer.position.y
          }
        };
        targetContainer.cursor = 'grabbing';
      });

      this.tokenLayer.addChild(container);
      this.tokens.set(token.id, container);
    }

    // Redraw graphics
    const radius = (this.gridConfig.size / 2) * 0.85;

    const ring = container.getChildByLabel('ring') as Graphics;
    if (ring) {
      ring.clear();
      ring.circle(0, 0, radius + 3).stroke({ color: 0x60a5fa, width: 2, alpha: 0.8 });
    }

    const body = container.getChildByLabel('body') as Graphics;
    if (body) {
      body.clear();
      body.circle(0, 0, radius).fill({ color: 0x18181b });
      body.circle(0, 0, radius - 1).stroke({ color: 0xffffff, width: 1.5, alpha: 0.3 });
    }

    const hpBar = container.getChildByLabel('hpBar') as Graphics;
    if (hpBar) {
      hpBar.clear();
      if (token.hp) {
        const [curr, max] = token.hp;
        const barWidth = radius * 1.6;
        const barHeight = 4;
        const pct = Math.max(0, Math.min(1, curr / max));
        const color = pct > 0.5 ? 0x22c55e : pct > 0.2 ? 0xeab308 : 0xef4444;

        hpBar.roundRect(-barWidth / 2, radius + 4, barWidth, barHeight, 2).fill({ color: 0x27272a });
        hpBar.roundRect(-barWidth / 2, radius + 4, barWidth * pct, barHeight, 2).fill({ color });
      }
    }

    container.position.set(token.x, token.y);
  }

  private renderDefaultMap(): void {
    this.mapLayer.clear();

    const arenaRadius = 1600;
    // Dark stone arena surface
    this.mapLayer.circle(0, 0, arenaRadius).fill({ color: 0x09090b });
    this.mapLayer.circle(0, 0, arenaRadius).stroke({ color: 0x27272a, width: 2 });

    // Concentric subtle circles for spatial depth
    for (let r = 200; r < arenaRadius; r += 200) {
      this.mapLayer.circle(0, 0, r).stroke({ color: 0xffffff, width: 1, alpha: 0.04 });
    }
  }

  private renderGrid(): void {
    this.gridLayer.clear();
    const size = this.gridConfig.size;
    const extent = 1600;

    if (this.gridConfig.type === 'hex') {
      const hexR = size / Math.sqrt(3);
      const hDist = Math.sqrt(3) * hexR;
      const vDist = 1.5 * hexR;

      for (let y = -extent; y <= extent; y += vDist) {
        const offset = Math.round(y / vDist) % 2 === 0 ? 0 : hDist / 2;
        for (let x = -extent; x <= extent; x += hDist) {
          this.drawHex(x + offset, y, hexR);
        }
      }
    } else {
      for (let x = -extent; x <= extent; x += size) {
        this.gridLayer.moveTo(x, -extent).lineTo(x, extent).stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
      }
      for (let y = -extent; y <= extent; y += size) {
        this.gridLayer.moveTo(-extent, y).lineTo(extent, y).stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
      }
    }
  }

  private drawHex(cx: number, cy: number, radius: number): void {
    const points: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }

    this.gridLayer.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < 6; i++) {
      this.gridLayer.lineTo(points[i][0], points[i][1]);
    }
    this.gridLayer.closePath().stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const oldScale = this.world.scale.x;
    const newScale = Math.min(Math.max(oldScale * zoomFactor, 0.2), 3.5);

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Zoom towards mouse pointer
    const worldPos = {
      x: (mouseX - this.world.x) / oldScale,
      y: (mouseY - this.world.y) / oldScale
    };

    this.world.scale.set(newScale);
    this.world.position.set(mouseX - worldPos.x * newScale, mouseY - worldPos.y * newScale);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button === 1 || this.activeTool === 'pan' || (event.button === 0 && this.isSpacePressed)) {
      this.isPanning = true;
      this.panStart = { x: event.clientX, y: event.clientY };
      this.worldStart = { x: this.world.x, y: this.world.y };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (this.activeTool === 'ruler' && event.button === 0) {
      const worldPos = this.screenToWorld(event.clientX, event.clientY);
      const snapped = snapToGrid(worldPos.x, worldPos.y, this.gridConfig);
      this.isMeasuring = true;
      this.rulerStart = snapped;
      this.updateRuler(snapped, snapped);
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.isPanning) {
      const dx = event.clientX - this.panStart.x;
      const dy = event.clientY - this.panStart.y;
      this.world.position.set(this.worldStart.x + dx, this.worldStart.y + dy);
      return;
    }

    if (this.draggedToken) {
      const worldPos = this.screenToWorld(event.clientX, event.clientY);
      const rawX = worldPos.x - this.draggedToken.offset.x;
      const rawY = worldPos.y - this.draggedToken.offset.y;

      this.draggedToken.container.position.set(rawX, rawY);
      this.onTokenMove?.(this.draggedToken.id, rawX, rawY);
      return;
    }

    if (this.isMeasuring && this.activeTool === 'ruler') {
      const worldPos = this.screenToWorld(event.clientX, event.clientY);
      const snapped = snapToGrid(worldPos.x, worldPos.y, this.gridConfig);
      this.updateRuler(this.rulerStart, snapped);
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.activeTool === 'pan' ? 'grab' : 'default';
    }

    if (this.draggedToken) {
      const snapped = snapToGrid(
        this.draggedToken.container.position.x,
        this.draggedToken.container.position.y,
        this.gridConfig
      );
      this.draggedToken.container.position.set(snapped.x, snapped.y);
      this.draggedToken.container.cursor = 'grab';

      const tokenId = this.draggedToken.id;
      this.draggedToken = null;

      this.onTokenMoveEnd?.(tokenId, snapped.x, snapped.y);
    }

    if (this.isMeasuring && this.activeTool === 'ruler') {
      this.isMeasuring = false;
      // Keep ruler visible until clicked again or tool switched
    }
  }

  private updateRuler(start: { x: number; y: number }, end: { x: number; y: number }): void {
    this.rulerLayer.clear();

    const dist = calculateDistance(start, end, this.gridConfig);

    // Glowing Apple-style measurement line
    this.rulerLayer.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: 0x38bdf8, width: 3, alpha: 0.9 });
    this.rulerLayer.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: 0xffffff, width: 1, alpha: 0.8 });

    // Endpoints
    this.rulerLayer.circle(start.x, start.y, 4).fill({ color: 0x38bdf8 });
    this.rulerLayer.circle(end.x, end.y, 6).fill({ color: 0x38bdf8 });
    this.rulerLayer.circle(end.x, end.y, 3).fill({ color: 0xffffff });

    if (this.rulerLabel) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2 - 14;
      const unitWord = this.gridConfig.type === 'hex' ? 'hex' : 'sq';
      this.rulerLabel.text = `${dist.distance} ft (${dist.cells} ${unitWord})`;
      this.rulerLabel.position.set(midX, midY);
      this.rulerLabel.visible = true;
    }
  }

  private clearRuler(): void {
    this.isMeasuring = false;
    this.rulerLayer.clear();
    if (this.rulerLabel) {
      this.rulerLabel.visible = false;
    }
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    return {
      x: (mouseX - this.world.x) / this.world.scale.x,
      y: (mouseY - this.world.y) / this.world.scale.y
    };
  }

  private handleResize(): void {
    if (!this.app || !this.app.renderer) return;
    this.app.renderer.resize(this.container.clientWidth, this.container.clientHeight);
  }

  public destroy(): void {
    this.canvas.removeEventListener('wheel', this.boundOnWheel);
    this.canvas.removeEventListener('pointerdown', this.boundOnPointerDown);
    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
    window.removeEventListener('keydown', this.boundOnKeyDown);
    window.removeEventListener('keyup', this.boundOnKeyUp);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
