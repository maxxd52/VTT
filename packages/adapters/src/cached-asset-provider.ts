import type { AssetProvider, AssetReference } from '@vtt/core';
import { AssetCacheDatabase } from './dexie-asset-cache';
import { SparkAssetProvider } from './spark-asset-provider';

export interface CachedAssetProviderOptions {
  dbName?: string;
  fetchFn?: typeof fetch;
  baseProvider?: AssetProvider;
}

/**
 * High-performance asset provider backed by Dexie.js (IndexedDB)
 * with in-memory fallback for headless/Node environments.
 * Enforces ARCHITECTURE.md Invariant #5:
 * "Cache all remote assets locally. Every Cloud Storage download must check Dexie.js
 * by content hash before hitting the network."
 */
export class CachedAssetProvider implements AssetProvider {
  private db: AssetCacheDatabase | null = null;
  private memoryCache = new Map<string, Blob>();
  private baseProvider: AssetProvider;
  private fetchFn: typeof fetch;

  constructor(options: CachedAssetProviderOptions = {}) {
    this.baseProvider = options.baseProvider ?? new SparkAssetProvider();
    this.fetchFn = options.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : async () => {
      throw new Error('Fetch API is not available');
    });

    if (typeof indexedDB !== 'undefined') {
      try {
        this.db = new AssetCacheDatabase(options.dbName ?? 'vtt_asset_cache');
      } catch {
        this.db = null;
      }
    }
  }

  async resolveAssetUrl(assetIdOrUrl: string): Promise<AssetReference> {
    const baseRef = await this.baseProvider.resolveAssetUrl(assetIdOrUrl);

    // Bundled relative paths (/assets/...) are already hosted locally
    if (baseRef.url.startsWith('/assets/')) {
      return baseRef;
    }

    try {
      // 1. Check IndexedDB cache or in-memory fallback
      if (this.db) {
        const cached = await this.db.assets.get(baseRef.hash);
        if (cached && cached.blob) {
          const objectUrl = typeof URL !== 'undefined' && URL.createObjectURL
            ? URL.createObjectURL(cached.blob)
            : baseRef.url;

          return { url: objectUrl, hash: cached.hash };
        }
      } else {
        const memBlob = this.memoryCache.get(baseRef.hash);
        if (memBlob) {
          const objectUrl = typeof URL !== 'undefined' && URL.createObjectURL
            ? URL.createObjectURL(memBlob)
            : baseRef.url;

          return { url: objectUrl, hash: baseRef.hash };
        }
      }

      // 2. Cache miss: download once
      const response = await this.fetchFn(baseRef.url);
      if (!response.ok) {
        throw new Error(`Failed to download asset from ${baseRef.url}: status ${response.status}`);
      }

      const blob = await response.blob();

      if (this.db) {
        await this.db.assets.put({
          hash: baseRef.hash,
          url: baseRef.url,
          blob,
          cachedAt: Date.now()
        });
      } else {
        this.memoryCache.set(baseRef.hash, blob);
      }

      const objectUrl = typeof URL !== 'undefined' && URL.createObjectURL
        ? URL.createObjectURL(blob)
        : baseRef.url;

      return {
        url: objectUrl,
        hash: baseRef.hash
      };
    } catch {
      // Graceful fallback to remote url if offline/error
      return baseRef;
    }
  }

  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    if (this.db) {
      await this.db.assets.clear();
    }
  }
}
