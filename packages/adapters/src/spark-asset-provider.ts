import type { AssetProvider, AssetReference } from '@vtt/core';

/**
 * Spark-plan-compatible asset resolver supporting bundled Firebase Hosting paths
 * (`/assets/...`) and validated external HTTPS URLs.
 */
export class SparkAssetProvider implements AssetProvider {
  async resolveAssetUrl(assetIdOrUrl: string): Promise<AssetReference> {
    const trimmed = assetIdOrUrl.trim();
    if (!trimmed) {
      throw new Error('Asset URL or path cannot be empty');
    }

    if (trimmed.startsWith('/assets/')) {
      return {
        url: trimmed,
        hash: computeSimpleHash(trimmed)
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(`Invalid asset reference: "${trimmed}"`);
    }

    if (parsed.protocol !== 'https:') {
      throw new Error('Only HTTPS external asset URLs or bundled /assets/ paths are permitted');
    }

    return {
      url: parsed.toString(),
      hash: computeSimpleHash(parsed.toString())
    };
  }
}

function computeSimpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}`;
}
