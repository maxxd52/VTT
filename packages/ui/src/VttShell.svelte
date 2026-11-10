<script lang="ts">
  import { onMount } from 'svelte';
  import type { AssetProvider, NetworkTransport, ToolMode } from '@vtt/core';
  import SessionHeader from './SessionHeader.svelte';
  import SideDrawer, { type RollEntry } from './SideDrawer.svelte';
  import Toolbar from './Toolbar.svelte';

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

  function handleQuickRoll(sides: number) {
    const rolled = Math.floor(Math.random() * sides) + 1;
    const expression = `1d${sides}`;
    transport.emitDiceRoll(expression, {
      expression,
      total: rolled,
      rolls: [rolled],
      modifier: 0
    });
  }

  function handleToolSelect(tool: ToolMode) {
    activeTool = tool;
    if (tool === 'dice') {
      drawerOpen = true;
    }
  }
</script>

<main class="vtt-canvas-backdrop relative h-screen w-screen overflow-hidden">
  <!-- Viewport Canvas Placeholder (Pixi.js v8 mounts here in Slice 2) -->
  <div class="absolute inset-0 flex items-center justify-center">
    <div class="pointer-events-none flex flex-col items-center text-center opacity-70">
      <div
        class="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[11px] font-medium tracking-wide text-zinc-400"
      >
        Active Tool: <span class="text-zinc-200 uppercase">{activeTool}</span>
      </div>
      <p class="mt-2 text-xs text-zinc-500">
        Pixi.js v8 2D Board Surface &bull; Asset Ready: {resolvedMapUrl ? 'Yes' : 'Initializing'}
      </p>
    </div>
  </div>

  <!-- Floating HUD Overlay -->
  <div class="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
    <div class="flex items-start justify-between">
      <SessionHeader {roomName} {roomCode} {connected} {playerCount} {isHost} />
      <SideDrawer
        open={drawerOpen}
        {rolls}
        onToggle={() => (drawerOpen = !drawerOpen)}
        onQuickRoll={handleQuickRoll}
      />
    </div>

    <div class="flex justify-center pb-1">
      <Toolbar {activeTool} {isHost} onSelectTool={handleToolSelect} />
    </div>
  </div>
</main>
