import Dexie, { type Table } from 'dexie';

export interface CachedAssetRecord {
  hash: string;
  url: string;
  blob: Blob;
  cachedAt: number;
}

export class AssetCacheDatabase extends Dexie {
  assets!: Table<CachedAssetRecord, string>;

  constructor(dbName = 'vtt_asset_cache') {
    super(dbName);
    this.version(1).stores({
      assets: 'hash, url, cachedAt'
    });
  }
}
