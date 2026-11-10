<script lang="ts">
  import { onMount } from 'svelte';
  import { parseAndRollDice, type AssetProvider, type NetworkTransport, type ToolMode } from '@vtt/core';
  import SessionHeader from './SessionHeader.svelte';
  import SideDrawer, { type RollEntry } from './SideDrawer.svelte';
  import Toolbar from './Toolbar.svelte';
  import BoardCanvas from './BoardCanvas.svelte';

  interface Props {
    transport: NetworkTransport;
    assetProvider: AssetProvider;
    roomName?: string;
    roomCode?: string;
    displayName?: string;
    isHost?: boolean;
  }

  let {
    transport,
    assetProvider,
    roomName = 'Crimson Crypt',
    roomCode = 'VTT-101',
    displayName = 'Game Master',
    isHost = true
  }: Props = $props();

  let activeTool = $state<ToolMode>('select');
  let drawerOpen = $state(true);
  let connected = $state(false);
  let playerCount = $state(1);
  let rolls = $state<RollEntry[]>([]);
  let resolvedMapUrl = $state<string | null>(null);

  onMount(() => {
    const unsubscribe = transport.onStateEvent((event) => {
      if (event.type === 'session:joined') {
        connected = true;
      } else if (event.type === 'session:left') {
        connected = false;
      } else if (event.type === 'dice:rolled') {
        const entry: RollEntry = {
          id: `${event.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
          actor: event.actor,
          expression: event.result.expression,
          total: event.result.total,
          rolls: event.result.rolls,
          timestamp: event.timestamp
        };
        rolls = [entry, ...rolls].slice(0, 50);
      }
    });

    void transport.joinSession(roomCode, displayName, isHost);
    void assetProvider
      .resolveAssetUrl('/assets/maps/default-grid.webp')
      .then((res) => {
        resolvedMapUrl = res.url;
      })
      .catch(() => {
        resolvedMapUrl = null;
      });

    return () => {
      unsubscribe();
      void transport.leaveSession();
    };
  });

  function handleRollExpression(expression: string) {
    try {
      const result = parseAndRollDice(expression);
      transport.emitDiceRoll(expression, result);
    } catch (err) {
      console.warn('Invalid dice roll expression:', err);
    }
  }

  function handleQuickRoll(sides: number) {
    handleRollExpression(`1d${sides}`);
  }

  function handleToolSelect(tool: ToolMode) {
    activeTool = tool;
    if (tool === 'dice') {
      drawerOpen = true;
    }
  }
</script>

<main class="vtt-canvas-backdrop relative h-screen w-screen overflow-hidden">
  <!-- Hardware-Accelerated Board Viewport (Pixi.js v8) -->
  <BoardCanvas {activeTool} {transport} {isHost} />

  <!-- Floating HUD Overlay -->
  <div class="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
    <div class="flex items-start justify-between">
      <SessionHeader {roomName} {roomCode} {connected} {playerCount} {isHost} />
      <SideDrawer
        open={drawerOpen}
        {rolls}
        onToggle={() => (drawerOpen = !drawerOpen)}
        onQuickRoll={handleQuickRoll}
        onCustomRoll={handleRollExpression}
      />
    </div>

    <div class="flex justify-center pb-1">
      <Toolbar {activeTool} {isHost} onSelectTool={handleToolSelect} />
    </div>
  </div>
</main>
