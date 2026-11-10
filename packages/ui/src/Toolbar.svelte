<script lang="ts">
  import { CloudFog, Dices, Hand, MousePointer2, Ruler } from '@lucide/svelte';
  import type { ToolMode } from '@vtt/core';

  interface Props {
    activeTool: ToolMode;
    isHost: boolean;
    onSelectTool: (tool: ToolMode) => void;
  }

  let { activeTool, isHost, onSelectTool }: Props = $props();

  const tools: Array<{ id: ToolMode; label: string; hostOnly?: boolean }> = [
    { id: 'select', label: 'Select' },
    { id: 'pan', label: 'Pan' },
    { id: 'ruler', label: 'Measure' },
    { id: 'fog', label: 'Fog', hostOnly: true },
    { id: 'dice', label: 'Dice' }
  ];

  const visibleTools = $derived(tools.filter((tool) => !tool.hostOnly || isHost));
</script>

<nav
  aria-label="Tabletop Tools"
  class="vtt-glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5"
>
  {#each visibleTools as tool (tool.id)}
    {@const active = activeTool === tool.id}
    <button
      type="button"
      onclick={() => onSelectTool(tool.id)}
      aria-pressed={active}
      title={tool.label}
      class="group relative flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 {active
        ? 'bg-white/16 text-white shadow-inner'
        : 'text-zinc-400 hover:bg-white/8 hover:text-zinc-100 active:scale-95'}"
    >
      {#if tool.id === 'select'}
        <MousePointer2 class="h-4 w-4" strokeWidth={1.75} />
      {:else if tool.id === 'pan'}
        <Hand class="h-4 w-4" strokeWidth={1.75} />
      {:else if tool.id === 'ruler'}
        <Ruler class="h-4 w-4" strokeWidth={1.75} />
      {:else if tool.id === 'fog'}
        <CloudFog class="h-4 w-4" strokeWidth={1.75} />
      {:else if tool.id === 'dice'}
        <Dices class="h-4 w-4" strokeWidth={1.75} />
      {/if}
      <span class="hidden sm:inline">{tool.label}</span>
    </button>
  {/each}
</nav>
