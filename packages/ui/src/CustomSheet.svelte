<script lang="ts">
  import {
    evaluateSheet,
    resolveActionRoll,
    type SheetTemplate
  } from '@vtt/core';
  import { Dices, Minus, Plus, Shield, Swords, Zap } from '@lucide/svelte';

  interface Props {
    template?: SheetTemplate;
    initialValues?: Record<string, number | string>;
    onRollAction?: (resolvedRoll: string, label: string) => void;
    onChange?: (values: Record<string, number | string>) => void;
  }

  const defaultTemplate: SheetTemplate = {
    systemId: 'd20-heroic-lite',
    name: 'Valeros the Fighter',
    fields: [
      { key: 'name', label: 'Character Name', type: 'text', default: 'Valeros' },
      { key: 'hp', label: 'Hit Points', type: 'number', default: 28 },
      { key: 'maxHp', label: 'Max HP', type: 'number', default: 30 },
      { key: 'str', label: 'STR', type: 'number', default: 16 },
      { key: 'dex', label: 'DEX', type: 'number', default: 14 },
      { key: 'con', label: 'CON', type: 'number', default: 14 },
      { key: 'strMod', label: 'STR Mod', type: 'computed', formula: 'floor((str - 10) / 2)' },
      { key: 'dexMod', label: 'DEX Mod', type: 'computed', formula: 'floor((dex - 10) / 2)' },
      { key: 'conMod', label: 'CON Mod', type: 'computed', formula: 'floor((con - 10) / 2)' },
      { key: 'ac', label: 'Armor Class', type: 'computed', formula: '10 + dexMod + 4' },
      { key: 'init', label: 'Initiative', type: 'computed', formula: 'dexMod' }
    ],
    actions: [
      { label: 'Longsword Strike', roll: '1d20 + strMod + 2' },
      { label: 'Longsword Damage', roll: '1d8 + strMod' },
      { label: 'Heavy Crossbow', roll: '1d20 + dexMod' },
      { label: 'Strength Save', roll: '1d20 + strMod' }
    ]
  };

  let {
    template = defaultTemplate,
    initialValues = {},
    onRollAction,
    onChange
  }: Props = $props();

  let userValues = $state<Record<string, number | string>>({});
  const rawValues = $derived({ ...initialValues, ...userValues });
  const evaluated = $derived(evaluateSheet(template, rawValues));

  function updateValue(key: string, value: number | string) {
    userValues = { ...userValues, [key]: value };
    onChange?.({ ...rawValues, [key]: value });
  }

  function adjustNumber(key: string, delta: number) {
    const current = Number(evaluated[key] ?? 0);
    updateValue(key, current + delta);
  }

  function formatMod(val: number | string | undefined): string {
    const num = Number(val ?? 0);
    return num >= 0 ? `+${num}` : `${num}`;
  }
</script>

<div class="flex h-full flex-col overflow-y-auto p-3 text-xs">
  <!-- Character Summary Banner -->
  <div class="rounded-xl border border-white/8 bg-white/4 p-2.5">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold tracking-tight text-white">
        {evaluated['name'] || 'Character'}
      </span>
      <span class="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
        {template.systemId}
      </span>
    </div>

    <!-- Quick Vital Badges (HP, AC, Initiative) -->
    <div class="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
      <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-1.5">
        <span class="block text-[10px] font-medium text-emerald-400 uppercase">HP</span>
        <span class="text-sm font-bold text-white tabular-nums">
          {evaluated['hp']}/{evaluated['maxHp']}
        </span>
      </div>

      <div class="rounded-lg border border-sky-500/20 bg-sky-500/10 p-1.5">
        <div class="flex items-center justify-center gap-1 text-[10px] font-medium text-sky-400 uppercase">
          <Shield class="h-3 w-3" />
          <span>AC</span>
        </div>
        <span class="text-sm font-bold text-white tabular-nums">
          {evaluated['ac']}
        </span>
      </div>

      <div class="rounded-lg border border-amber-500/20 bg-amber-500/10 p-1.5">
        <div class="flex items-center justify-center gap-1 text-[10px] font-medium text-amber-400 uppercase">
          <Zap class="h-3 w-3" />
          <span>INIT</span>
        </div>
        <span class="text-sm font-bold text-white tabular-nums">
          {formatMod(evaluated['init'])}
        </span>
      </div>
    </div>
  </div>

  <!-- Core Attributes (STR, DEX, CON) -->
  <div class="mt-3">
    <span class="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Attributes</span>
    <div class="mt-1.5 grid grid-cols-3 gap-1.5">
      {#each ['str', 'dex', 'con'] as attr (attr)}
        {@const modKey = `${attr}Mod`}
        <div class="rounded-xl border border-white/8 bg-white/4 p-2 text-center">
          <span class="text-[10px] font-bold text-zinc-400 uppercase">{attr}</span>
          <div class="mt-1 text-base font-bold text-white tabular-nums">
            {evaluated[attr] ?? 10}
          </div>
          <div class="mt-0.5 inline-block rounded-md bg-white/10 px-1.5 py-0.2 text-[10px] font-semibold text-sky-300">
            {formatMod(evaluated[modKey])}
          </div>
          <div class="mt-1.5 flex items-center justify-center gap-1">
            <button
              type="button"
              onclick={() => adjustNumber(attr, -1)}
              class="flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/14"
            >
              <Minus class="h-3 w-3" />
            </button>
            <button
              type="button"
              onclick={() => adjustNumber(attr, 1)}
              class="flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/14"
            >
              <Plus class="h-3 w-3" />
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Actions & Attacks -->
  <div class="mt-3 flex-1">
    <span class="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">Actions & Attacks</span>
    <div class="mt-1.5 space-y-1.5">
      {#each template.actions as action (action.label)}
        {@const resolvedRoll = resolveActionRoll(action.roll, evaluated)}
        <button
          type="button"
          onclick={() => onRollAction?.(resolvedRoll, action.label)}
          class="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/8 bg-white/5 p-2 text-left transition hover:border-sky-400/30 hover:bg-white/10 active:scale-[0.98]"
        >
          <div class="flex items-center gap-2">
            <div class="rounded-lg bg-sky-500/15 p-1 text-sky-400 group-hover:bg-sky-500/25">
              <Swords class="h-3.5 w-3.5" />
            </div>
            <div>
              <p class="text-xs font-medium text-white">{action.label}</p>
              <p class="font-mono text-[10px] text-zinc-400">{action.roll}</p>
            </div>
          </div>
          <div class="flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-300">
            <Dices class="h-3 w-3" />
            <span>{resolvedRoll}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
</div>
