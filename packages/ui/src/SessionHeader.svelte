<script lang="ts">
  import { Check, Copy, Users } from '@lucide/svelte';

  interface Props {
    roomName: string;
    roomCode: string;
    connected: boolean;
    playerCount: number;
    isHost: boolean;
  }

  let { roomName, roomCode, connected, playerCount, isHost }: Props = $props();
  let copied = $state(false);

  async function copyInvite() {
    const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(roomCode)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // Clipboard API may be blocked in non-secure contexts
    }
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1800);
  }
</script>

<header
  class="vtt-glass pointer-events-auto flex items-center gap-3 rounded-full px-4 py-1.5 text-xs text-zinc-200 transition-all"
>
  <div class="flex items-center gap-2">
    <span
      class="h-2 w-2 rounded-full transition-colors {connected
        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]'
        : 'bg-amber-400'}"
      aria-label={connected ? 'Connected' : 'Connecting'}
    ></span>
    <span class="font-medium tracking-tight text-white">{roomName}</span>
    {#if isHost}
      <span
        class="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-300 uppercase"
      >
        GM
      </span>
    {/if}
  </div>

  <div class="h-3.5 w-px bg-white/10"></div>

  <div class="flex items-center gap-1.5 text-zinc-400">
    <Users class="h-3.5 w-3.5" strokeWidth={1.75} />
    <span class="tabular-nums">{playerCount}</span>
  </div>

  <div class="h-3.5 w-px bg-white/10"></div>

  <button
    type="button"
    onclick={copyInvite}
    class="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-medium text-zinc-100 transition hover:bg-white/15 active:scale-95"
  >
    {#if copied}
      <Check class="h-3 w-3 text-emerald-400" strokeWidth={2} />
      <span class="text-emerald-300">Copied</span>
    {:else}
      <Copy class="h-3 w-3 text-zinc-300" strokeWidth={1.75} />
      <span>Invite</span>
    {/if}
  </button>
</header>
