<script lang="ts">
  import { Dices, FileText, PanelRightClose, PanelRightOpen } from '@lucide/svelte';

  export interface RollEntry {
    id: string;
    actor: string;
    expression: string;
    total: number;
    rolls: number[];
    timestamp: number;
  }

  interface Props {
    open: boolean;
    rolls: RollEntry[];
    onToggle: () => void;
    onQuickRoll: (sides: number) => void;
  }

  let { open, rolls, onToggle, onQuickRoll }: Props = $props();
  let activeTab = $state<'feed' | 'sheet'>('feed');
  const diceSides = [4, 6, 8, 10, 12, 20];
</script>

<div class="pointer-events-auto flex flex-col items-end gap-2">
  <button
    type="button"
    onclick={onToggle}
    aria-label={open ? 'Collapse inspector panel' : 'Open inspector panel'}
    class="vtt-glass flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/12 hover:text-white active:scale-95"
  >
    {#if open}
      <PanelRightClose class="h-4 w-4" strokeWidth={1.75} />
    {:else}
      <PanelRightOpen class="h-4 w-4" strokeWidth={1.75} />
    {/if}
  </button>

  {#if open}
    <aside
      class="vtt-glass flex h-[calc(100vh-8rem)] max-h-[580px] w-76 flex-col overflow-hidden rounded-2xl transition-all"
    >
      <div class="border-b border-white/8 p-2">
        <div class="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1 text-xs font-medium">
          <button
            type="button"
            onclick={() => (activeTab = 'feed')}
            class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 transition {activeTab ===
            'feed'
              ? 'bg-white/14 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'}"
          >
            <Dices class="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Rolls</span>
          </button>
          <button
            type="button"
            onclick={() => (activeTab = 'sheet')}
            class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 transition {activeTab ===
            'sheet'
              ? 'bg-white/14 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'}"
          >
            <FileText class="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Sheet</span>
          </button>
        </div>
      </div>

      {#if activeTab === 'feed'}
        <div class="flex flex-1 flex-col overflow-hidden">
          <div class="grid grid-cols-6 gap-1 border-b border-white/8 p-2.5">
            {#each diceSides as sides (sides)}
              <button
                type="button"
                onclick={() => onQuickRoll(sides)}
                class="cursor-pointer rounded-lg border border-white/8 bg-white/5 py-1.5 text-[11px] font-semibold tracking-tight text-zinc-200 transition hover:border-white/20 hover:bg-white/14 active:scale-95"
              >
                d{sides}
              </button>
            {/each}
          </div>

          <div class="flex-1 space-y-2 overflow-y-auto p-3">
            {#if rolls.length === 0}
              <div class="flex h-full flex-col items-center justify-center text-center">
                <p class="text-xs font-medium text-zinc-400">No rolls yet</p>
                <p class="mt-1 text-[11px] text-zinc-500">Tap any die above to roll</p>
              </div>
            {:else}
              {#each rolls as entry (entry.id)}
                <div class="rounded-xl border border-white/6 bg-white/4 px-3 py-2">
                  <div class="flex items-center justify-between text-[11px] text-zinc-400">
                    <span class="font-medium text-zinc-300">{entry.actor}</span>
                    <span class="font-mono text-[10px]">{entry.expression}</span>
                  </div>
                  <div class="mt-1 flex items-baseline justify-between">
                    <span class="text-lg font-semibold tracking-tight text-white tabular-nums">
                      {entry.total}
                    </span>
                    <span class="font-mono text-[10px] text-zinc-500">
                      [{entry.rolls.join(', ')}]
                    </span>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {:else}
        <div class="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
            <FileText class="h-6 w-6 text-zinc-400" strokeWidth={1.5} />
          </div>
          <p class="mt-3 text-xs font-medium text-zinc-200">Declarative Custom Sheet</p>
          <p class="mt-1 text-[11px] leading-relaxed text-zinc-400">
            System-agnostic JSON sheet engine ready for Slice 5.
          </p>
        </div>
      {/if}
    </aside>
  {/if}
</div>
