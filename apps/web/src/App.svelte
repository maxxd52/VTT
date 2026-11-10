<script lang="ts">
  import { CachedAssetProvider, FirebaseRTDBTransport, InMemoryNetworkTransport } from '@vtt/adapters';
  import { VttShell } from '@vtt/ui';

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const roomCode = params?.get('room') || 'VTT-101';
  const isHost = params?.has('room') ? params?.get('host') === '1' : true;
  const displayName = params?.get('name') || (isHost ? 'Game Master' : 'Player');
  const forceMemory = params?.get('memory') === '1';

  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
  const transport = forceMemory
    ? new InMemoryNetworkTransport()
    : new FirebaseRTDBTransport({
        useEmulator: true,
        emulatorHost: host,
        databasePort: 9000,
        authPort: 9099
      });
  const assetProvider = new CachedAssetProvider();
</script>

<VttShell {transport} {assetProvider} roomName="Crimson Crypt" {roomCode} {displayName} {isHost} />
