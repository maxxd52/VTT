<script lang="ts">
  import { CachedAssetProvider, InMemoryNetworkTransport } from '@vtt/adapters';
  import { VttShell } from '@vtt/ui';

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const roomCode = params?.get('room') || 'VTT-101';
  const isHost = params?.has('room') ? params?.get('host') === '1' : true;
  const displayName = isHost ? 'Game Master' : 'Player';

  const transport = new InMemoryNetworkTransport();
  const assetProvider = new CachedAssetProvider();
</script>

<VttShell {transport} {assetProvider} roomName="Crimson Crypt" {roomCode} {displayName} {isHost} />
