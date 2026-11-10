<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BoardEngine,
    type GridConfig,
    type NetworkTransport,
    type TokenState,
    type ToolMode
  } from '@vtt/core';

  interface Props {
    activeTool: ToolMode;
    transport: NetworkTransport;
    isHost?: boolean;
    gridConfig?: GridConfig;
    initialTokens?: TokenState[];
  }

  let {
    activeTool,
    transport,
    isHost = true,
    gridConfig = { size: 60, type: 'square' },
    initialTokens = [
      { id: 'token-1', name: 'Valeros', x: -60, y: -60, imageUrl: '', hp: [28, 30] },
      { id: 'token-2', name: 'Merisiel', x: 60, y: 60, imageUrl: '', hp: [19, 22] }
    ]
  }: Props = $props();

  let containerRef: HTMLDivElement | null = $state(null);
  let canvasRef: HTMLCanvasElement | null = $state(null);
  let engine: BoardEngine | null = null;

  onMount(() => {
    if (!containerRef || !canvasRef) return;

    engine = new BoardEngine({
      canvas: canvasRef,
      container: containerRef,
      grid: gridConfig,
      isHost,
      onTokenMove: (id, x, y) => {
        transport.emitTokenMove(id, x, y);
      },
      onTokenMoveEnd: (id, x, y) => {
        transport.emitTokenMove(id, x, y);
      },
      onFogPatch: (patch) => {
        transport.emitFogPatch(patch);
      }
    });

    // Remote state may arrive before the async Pixi init finishes creating the
    // tokens; keep the latest known position so it is applied once they exist.
    const latestPositions = new Map<string, { x: number; y: number }>();
    let engineReady = false;

    void engine.init().then(() => {
      engine?.setTokens(
        initialTokens.map((token) => ({ ...token, ...latestPositions.get(token.id) }))
      );
      engine?.setTool(activeTool);
      engine?.setHost(isHost);
      engineReady = true;
    });

    const unsubscribe = transport.onStateEvent((event) => {
      if (event.type === 'token:moved') {
        latestPositions.set(event.tokenId, { x: event.x, y: event.y });
        if (engineReady) {
          engine?.updateTokenPosition(event.tokenId, event.x, event.y);
        }
      } else if (event.type === 'fog:patched') {
        engine?.applyFogPatch(event.patch);
      }
    });

    return () => {
      unsubscribe();
      engine?.destroy();
      engine = null;
    };
  });

  $effect(() => {
    if (engine) {
      engine.setTool(activeTool);
    }
  });

  $effect(() => {
    if (engine) {
      engine.setGridConfig(gridConfig);
    }
  });

  $effect(() => {
    if (engine) {
      engine.setHost(isHost);
    }
  });
</script>

<div
  bind:this={containerRef}
  class="absolute inset-0 h-full w-full overflow-hidden bg-zinc-950"
>
  <canvas
    bind:this={canvasRef}
    class="block h-full w-full touch-none select-none"
  ></canvas>
</div>
