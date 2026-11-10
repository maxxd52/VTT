<script lang="ts">
  import { InMemoryNetworkTransport, SparkAssetProvider } from '@vtt/adapters';
  import { VttShell } from '@vtt/ui';

  const transport = new InMemoryNetworkTransport();
  const assetProvider = new SparkAssetProvider();
</script>

<VttShell {transport} {assetProvider} roomName="Crimson Crypt" roomCode="VTT-101" />
